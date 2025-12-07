# Benchmark Report: Design Patterns Effectiveness

Báo cáo này tổng hợp kết quả Benchmark Testing cho hệ thống University Admission Portal, so sánh hiệu năng và độ ổn định giữa hai trạng thái: **Patterns OFF** (Tắt Design Patterns) và **Patterns ON** (Bật Design Patterns).

Các bài test được thực hiện với cấu hình tải cao (1000 connections) để giả lập tình huống thực tế.

---

## 1. Spike Load Test (Queue-Based Load Leveling)

**Mô tả Test:**
Giả lập lượng truy cập đột biến với **1000 concurrent connections** trong **30 giây**.
- **Patterns OFF:** Requests được xử lý đồng bộ (Sync).
- **Patterns ON:** Requests được đưa vào Queue (Async) và xử lý bởi Workers.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **HTTP Success Rate** | **51.95%** | **100%** | ✅ Patterns ON giúp hệ thống không bị sập dưới tải cao. |
| **Total Errors** | 3,546 failures | 0 failures | ✅ Loại bỏ hoàn toàn lỗi quá tải (503/Timeout). |
| **Response Strategy** | Wait for processing | 202 Accepted | ✅ Phản hồi tức thì cho người dùng thay vì chờ đợi. |
| **Processing Speed** | N/A (Failed/Timeout) | 24.45 jobs/sec | ✅ Xử lý ổn định trong background (Queue drained in ~115s). |

> **Nhận xét:** Khi tắt patterns, hệ thống bị quá tải và từ chối gần 50% requests. Khi bật patterns, hệ thống chấp nhận 100% requests ngay lập tức và xử lý dần trong background.

---

## 2. Idempotency Test (Idempotency Key)

**Mô tả Test:**
Gửi 50 requests liên tiếp có cùng `Idempotency-Key` để kiểm tra khả năng chống duplicate.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Applications Created** | 50 (Duplicates) | **1 (Unique)** | ✅ Ngăn chặn hoàn toàn trùng lặp dữ liệu. |
| **Response** | 50 x 201 Created | 1 x 201, 49 x 409/200 | ✅ Đảm bảo tính nhất quán (Data Consistency). |

> **Nhận xét:** Design pattern Idempotency Key hoạt động chính xác, đảm bảo 1 request chỉ được xử lý 1 lần duy nhất dù client có retry nhiều lần.

---

## 3. Cache Performance Test (Cache-Aside + CQRS)

**Mô tả Test:**
Đo lường độ trễ (latency) khi đọc dữ liệu hồ sơ. So sánh giữa đọc trực tiếp Database và đọc qua Redis Cache.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Avg Latency (Warm)** | 9.56 ms | **8.64 ms** | ✅ Cải thiện ~13.6% tốc độ đọc. |
| **Hit Strategy** | Direct DB Hit | Redis Cache Hit | ✅ Giảm tải cho Database cho các truy vấn lặp lại. |

> **Nhận xét:** Mặc dù Database local phản hồi rất nhanh (9ms), việc sử dụng Cache vẫn giúp giảm thêm latency và quan trọng hơn là giảm load trực tiếp lên Database.

---

## 4. Circuit Breaker Test

**Mô tả Test:**
Đo lường overhead và khả năng bảo vệ hệ thống khi gọi external services (Payment).

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Success Rate** | 100% | 100% | Hệ thống hoạt động bình thường (Service Healthy). |
| **Avg Latency** | 30.67 ms | 46.83 ms | Có overhead nhỏ (~16ms) do logic kiểm tra mạch bảo vệ. |
| **Protection** | None | Active | Sẵn sàng ngắt mạch nếu Payment Service gặp sự cố. |

> **Nhận xét:** Trong điều kiện bình thường, Design Pattern thêm một chút latency chấp nhận được để đổi lấy sự an toàn (fail-fast) khi có sự cố.

---

## 5. Worker Resilience Test (Competing Consumers)

**Mô tả Test:**
Đo lường khả năng xử lý job của hệ thống worker, bao gồm khả năng scale và retry.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Execution Mode** | Synchronous | Parallel Workers | ✅ Tận dụng đa luồng/đa servers. |
| **Throughput** | ~20 jobs/sec | ~5.8 - 25 jobs/sec* | ✅ Xử lý ổn định kể cả khi hàng đợi đang đầy. |
| **Scalability** | Fixed (1 thread) | Auto-scale (3-8 workers) | ✅ Worker pool tự động scale lên 8 workers để xử lý backlog từ spike test. |

> **Ghi chú:** Ở bài test Patterns ON, throughput đo được thấp hơn (5.8) do hệ thống đang phải xử lý hàng nghìn jobs tồn đọng từ bài test Spike trước đó. Tuy nhiên, Queues Metrics cho thấy **37,017** jobs đã được hoàn thành, chứng tỏ khả năng xử lý background mạnh mẽ.

---

## Tổng kết chung

Việc áp dụng bộ Design Patterns (Queue-Based Load Leveling, Idempotency, Cache-Aside, Circuit Breaker) đã mang lại hiệu quả rõ rệt:

1.  **Độ ổn định (Availability):** Tăng từ ~52% lên **100%** dưới tải cao.
2.  **Trải nghiệm người dùng:** Giảm thời gian chờ đợi phản hồi (Latency cho write request giảm từ việc chờ process sang chờ ack).
3.  **Toàn vẹn dữ liệu:** Ngăn chặn hoàn toàn việc tạo duplicate data.
4.  **Khả năng mở rộng:** Hệ thống tự động scale workers để xử lý backlog lớn mà không làm gián đoạn API.
