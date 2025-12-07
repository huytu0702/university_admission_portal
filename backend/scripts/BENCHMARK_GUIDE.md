# Hướng dẫn Benchmark Testing

Tài liệu này mô tả chi tiết các file benchmark test được sử dụng để đánh giá hiệu quả của các Design Patterns trong hệ thống University Admission Portal.

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Các Design Patterns được Test](#các-design-patterns-được-test)
3. [Chi tiết từng Benchmark](#chi-tiết-từng-benchmark)
4. [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)
5. [Kết quả mong đợi](#kết-quả-mong-đợi)

---

## Tổng quan

Hệ thống benchmark bao gồm 5 file test chính, mỗi file test một hoặc nhiều design patterns:

| File | Mục đích | Patterns được test |
|------|----------|-------------------|
| `benchmark-spike.ts` | Test khả năng chịu tải đột biến | Queue-Based Load Leveling, Bulkhead, Outbox |
| `benchmark-idempotency.ts` | Test ngăn chặn duplicate requests | Idempotency Key |
| `benchmark-cache.ts` | Test hiệu suất đọc với cache | Cache-Aside, CQRS-Lite |
| `benchmark-circuit-breaker.ts` | Test isolation khi có lỗi | Circuit Breaker |
| `benchmark-workers.ts` | Test xử lý song song và retry | Competing Consumers, Retry Backoff |

---

## Các Design Patterns được Test

### 1. Queue-Based Load Leveling
**Mô tả:** Sử dụng hàng đợi (Redis/BullMQ) để điều tiết luồng requests, tránh quá tải database.

**Lợi ích:**
- Phản hồi nhanh cho người dùng (trả về 202 Accepted ngay lập tức)
- Xử lý bất đồng bộ trong background
- Tăng khả năng chịu tải spike traffic

### 2. Idempotency Key
**Mô tả:** Ngăn chặn việc tạo duplicate applications khi client gửi lại request với cùng một key.

**Lợi ích:**
- Tránh tạo bản ghi trùng lặp
- An toàn khi retry requests
- Đảm bảo tính nhất quán dữ liệu

### 3. Outbox Pattern
**Mô tả:** Lưu messages vào database cùng transaction với business operation, sau đó relay đến queue.

**Lợi ích:**
- Đảm bảo at-least-once delivery
- Không mất messages khi có lỗi
- Tính nhất quán giữa database và queue

### 4. Cache-Aside (CQRS-Lite)
**Mô tả:** Cache dữ liệu đọc trong Redis để giảm tải database.

**Lợi ích:**
- Giảm latency đọc
- Giảm load lên database
- Cải thiện throughput đọc

### 5. Circuit Breaker
**Mô tả:** Ngắt mạch khi service downstream (payment) gặp lỗi liên tục.

**Lợi ích:**
- Fast-fail khi service không khả dụng
- Tránh cascading failures
- Cho phép service phục hồi

### 6. Bulkhead Isolation
**Mô tả:** Giới hạn số lượng concurrent jobs cho mỗi loại task.

**Lợi ích:**
- Cô lập lỗi giữa các subsystems
- Ngăn một service chiếm hết resources
- Đảm bảo fair resource allocation

### 7. Competing Consumers
**Mô tả:** Nhiều workers xử lý song song các jobs từ cùng một queue.

**Lợi ích:**
- Tăng throughput xử lý
- Horizontal scaling
- Load balancing tự động

### 8. Retry with Exponential Backoff
**Mô tả:** Tự động retry jobs thất bại với khoảng cách thời gian tăng dần.

**Lợi ích:**
- Tự động phục hồi từ transient errors
- Tránh overwhelm service đang gặp vấn đề
- Giảm tỷ lệ lỗi cuối cùng

---

## Chi tiết từng Benchmark

### 1. benchmark-spike.ts - Test Chịu Tải Đột Biến

**Mục đích:** Đánh giá khả năng xử lý khi có spike traffic (nhiều requests đồng thời).

**Cách hoạt động:**
1. Gửi N concurrent connections trong M giây
2. Đo HTTP acceptance rate (bao nhiêu request được chấp nhận)
3. Khi patterns ON: Đợi queue xử lý xong và đo processing rate
4. So sánh thời gian xử lý thực tế

**Các tham số:**
```bash
-c, --connections    Số concurrent connections (mặc định: 200)
-d, --duration       Thời gian test (giây, mặc định: 15)
-t, --queue-timeout  Timeout đợi queue drain (giây, mặc định: 120)
--no-wait            Không đợi queue processing
```

**Ví dụ:**
```bash
npx ts-node scripts/benchmark-spike.ts --connections 500 --duration 30
```

**Metrics thu thập:**
- `totalRequests`: Tổng số requests gửi đi
- `successRate`: Tỷ lệ HTTP success
- `avgLatency`, `maxLatency`: Độ trễ HTTP
- `queueDrainTimeMs`: Thời gian để queue xử lý xong
- `jobsCompleted`, `jobsFailed`: Số jobs hoàn thành/thất bại

---

### 2. benchmark-idempotency.ts - Test Ngăn Chặn Duplicate

**Mục đích:** Kiểm tra pattern Idempotency Key có ngăn chặn được duplicate requests không.

**Cách hoạt động:**
1. Tạo một idempotency key duy nhất
2. Gửi N requests với CÙNG MỘT idempotency key
3. Đếm số applications thực sự được tạo
4. Với pattern ON: Chỉ 1 application được tạo
5. Với pattern OFF: N applications được tạo (duplicate)

**Các tham số:**
```bash
-r, --requests    Số requests gửi (mặc định: 20)
```

**Ví dụ:**
```bash
npx ts-node scripts/benchmark-idempotency.ts --requests 50
```

**Metrics thu thập:**
- `applicationsCreated`: Số applications thực sự được tạo
- `duplicateRejected`: Số requests bị reject do duplicate
- `successfulRequests`: Số requests thành công

---

### 3. benchmark-cache.ts - Test Hiệu Suất Cache

**Mục đích:** Đo lường cải thiện latency khi sử dụng Cache-Aside pattern.

**Cách hoạt động:**
1. Tạo một test application
2. Thực hiện "cold reads" (cache miss - lần đọc đầu tiên)
3. Thực hiện "warm reads" (cache hit - các lần đọc sau)
4. So sánh latency giữa cold và warm reads
5. Tính % cải thiện latency

**Các tham số:**
```bash
-r, --requests    Số warm read requests (mặc định: 50)
-w, --warmup      Số cold read requests (mặc định: 10)
```

**Ví dụ:**
```bash
npx ts-node scripts/benchmark-cache.ts --requests 100 --warmup 20
```

**Metrics thu thập:**
- `avgColdLatency`: Latency trung bình khi cache miss
- `avgWarmLatency`: Latency trung bình khi cache hit
- `p95ColdLatency`, `p95WarmLatency`: P95 latency
- `latencyImprovement`: % cải thiện latency
- `cacheHitRate`: Tỷ lệ cache hit (ước tính)

---

### 4. benchmark-circuit-breaker.ts - Test Circuit Breaker

**Mục đích:** Kiểm tra Circuit Breaker có bảo vệ hệ thống khi service gặp lỗi không.

**Cách hoạt động:**
1. Gửi requests liên tục đến hệ thống
2. Theo dõi trạng thái circuit (CLOSED → OPEN → HALF_OPEN)
3. Đếm số requests bị reject khi circuit OPEN
4. Đo tốc độ fast-fail

**Các tham số:**
```bash
-r, --requests    Tổng số requests (mặc định: 30)
-b, --burst       Burst size để check circuit state (mặc định: 10)
-d, --delay       Delay giữa các requests (ms, mặc định: 100)
```

**Ví dụ:**
```bash
npx ts-node scripts/benchmark-circuit-breaker.ts --requests 50 --burst 10
```

**Metrics thu thập:**
- `successfulRequests`: Số requests thành công
- `failedRequests`: Số requests thất bại
- `circuitOpenRejects`: Số requests bị reject do circuit OPEN
- `circuitStateChanges`: Lịch sử thay đổi trạng thái circuit
- `finalCircuitState`: Trạng thái cuối cùng của circuit

---

### 5. benchmark-workers.ts - Test Worker Resilience

**Mục đích:** Đánh giá hiệu quả xử lý song song và retry của workers.

**Cách hoạt động:**
1. Submit N jobs vào queue
2. Đợi tất cả jobs được xử lý
3. Đo throughput (jobs/second)
4. Kiểm tra số jobs completed, failed, và trong DLQ
5. Đánh giá hiệu quả của Competing Consumers pattern

**Các tham số:**
```bash
-j, --jobs        Số jobs submit (mặc định: 20)
-t, --timeout     Timeout đợi queue drain (giây, mặc định: 120)
```

**Ví dụ:**
```bash
npx ts-node scripts/benchmark-workers.ts --jobs 100 --timeout 180
```

**Metrics thu thập:**
- `jobsSubmitted`: Số jobs đã submit
- `jobsCompleted`: Số jobs hoàn thành
- `jobsFailed`: Số jobs thất bại
- `jobsRetried`: Số jobs đã retry
- `dlqJobs`: Số jobs trong Dead Letter Queue
- `avgThroughput`: Jobs xử lý mỗi giây
- `queueMetrics`: Chi tiết từng queue (verify_document, create_payment, send_email)

---

## Hướng dẫn sử dụng

### Chạy nhanh tất cả benchmarks

```powershell
# 1. Bật tất cả patterns
npm run patterns:on

# 2. Chạy tất cả benchmarks
npm run benchmark:all

# 3. Tắt patterns để so sánh
npm run patterns:off
npm run benchmark:all
```

### Chạy từng benchmark riêng lẻ

```powershell
# Spike test
npm run benchmark:spike

# Idempotency test
npm run benchmark:idempotency

# Cache test
npm run benchmark:cache

# Circuit breaker test
npm run benchmark:circuit

# Workers test
npm run benchmark:workers
```

### Xem kết quả

Tất cả kết quả được lưu trong thư mục `backend/benchmark-results/`:

```
benchmark-results/
├── spike-2025-12-07T08-06-39-364Z.json
├── idempotency-*.json
├── cache-*.json
├── circuit-breaker-*.json
└── workers-*.json
```

---

## Kết quả mong đợi

### Khi Patterns BẬT (ON):

| Benchmark | Kết quả mong đợi |
|-----------|-----------------|
| **Spike** | >95% HTTP success rate, queue xử lý hoàn tất |
| **Idempotency** | Chỉ 1 application được tạo từ N duplicate requests |
| **Cache** | >20% latency improvement giữa cold và warm reads |
| **Circuit Breaker** | Fast-fail khi service unhealthy |
| **Workers** | >90% success rate, throughput >5 jobs/sec |

### Khi Patterns TẮT (OFF):

| Benchmark | Kết quả mong đợi |
|-----------|-----------------|
| **Spike** | Thấp hơn success rate, timeout cao hơn |
| **Idempotency** | N duplicate applications được tạo |
| **Cache** | Latency không thay đổi (không có cache) |
| **Circuit Breaker** | Không có protection, cascading failures có thể xảy ra |
| **Workers** | Xử lý tuần tự, không retry khi lỗi |

---

## Bảng tổng hợp Pattern Coverage

| Design Pattern | Benchmark Scripts |
|----------------|------------------|
| `queue-based-load-leveling` | benchmark-spike.ts, benchmark-workers.ts |
| `idempotency-key` | benchmark-idempotency.ts |
| `outbox-pattern` | benchmark-spike.ts (gián tiếp) |
| `cqrs-lite` | benchmark-cache.ts |
| `circuit-breaker-payment` | benchmark-circuit-breaker.ts |
| `bulkhead-isolation` | benchmark-spike.ts, benchmark-circuit-breaker.ts |
| `competing-consumers` | benchmark-workers.ts |
| `retry-exponential-backoff` | benchmark-workers.ts |
| `cache-aside` | benchmark-cache.ts |

---

## Lưu ý quan trọng

1. **Backend phải đang chạy** trước khi thực hiện benchmark
2. **Redis phải hoạt động** để queue và cache hoạt động đúng
3. **Database phải sẵn sàng** để lưu trữ dữ liệu test
4. Các benchmark tạo **test users và applications** - có thể xóa sau khi test
5. **Kết quả có thể khác nhau** tùy thuộc vào môi trường (CPU, RAM, network)
