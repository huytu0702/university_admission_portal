# Queue-Based Load Leveling (Cân bằng tải dựa trên hàng đợi)

## 1. Queue-Based Load Leveling là gì?

**Queue-Based Load Leveling** (Cân bằng tải dựa trên hàng đợi) là một kiến trúc thiết kế hệ thống giúp kiểm soát và cân bằng tải giữa các yêu cầu đến và khả năng xử lý của hệ thống. Thay vì xử lý trực tiếp tất cả các yêu cầu ngay khi chúng đến, hệ thống sẽ đưa chúng vào một hàng đợi để xử lý sau với tốc độ có thể kiểm soát được.

### Ví dụ dễ hiểu:

Hãy tưởng tượng một nhà hàng:
- **Không có hàng đợi**: Khi nhiều khách hàng đến cùng lúc, nhân viên pha chế sẽ bị quá tải, đồ uống bị làm sai, và khách hàng phải chờ đợi lâu.
- **Có hàng đợi**: Khách hàng đặt order tại quầy, nhận số thứ tự. Nhân viên pha chế làm lần lượt theo đúng thứ tự, đảm bảo chất lượng và tốc độ ổn định.

## 2. Tại sao cần Queue-Based Load Leveling?

### 2.1 Giải quyết các vấn đề:
- **Traffic Spikes**: Xử lý các đột biến traffic lớn
- **Resource Contention**: Tránh tranh chấp tài nguyên
- **System Overload**: Ngăn chặn hệ thống bị quá tải
- **Cascading Failures**: Tránh lỗi lan truyền (domino effect)

### 2.2 Lợi ích:
- **Predictable Performance**: Hiệu suất có thể dự đoán
- **Better Resource Utilization**: Sử dụng tài nguyên hiệu quả hơn
- **Improved Reliability**: Tăng độ tin cậy của hệ thống
- **Scalability**: Dễ dàng mở rộng theo chiều ngang

## 3. Triển khai trong hệ thống University Admission Portal

### 3.1 Kiến trúc tổng quan

```
Client Request → API Gateway → Queue Producer → Redis Queue → Worker Pool → Database
                           ↓
                       Load Balancer
```

### 3.2 Các thành phần chính

#### 3.2.1 Queue Producer Service (`queue-producer.service.ts`)
- **Chức năng**: Đưa jobs vào hàng đợi với ưu tiên khác nhau
- **Các queue chính**:
  - `verify_document`: Xác minh tài liệu ứng tuyển
  - `create_payment`: Xử lý thanh toán
  - `send_email`: Gửi email thông báo

**Ưu tiên jobs:**
```typescript
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

// Mapping priority sang số (số càng thấp, ưu tiên càng cao)
critical → 0
high     → 1
normal   → 2
low      → 3
```

**Ví dụ sử dụng:**
```typescript
// Thêm job xác minh tài liệu với ưu tiên cao
await queueProducer.addVerifyDocumentJob(
  'job_123',
  { applicantId: 'user_456', documentType: 'transcript' },
  'high'  // Ưu tiên cao
);
```

#### 3.2.2 Worker Load Balancer Service (`worker-load-balancer.service.ts`)
- **Chức năng**: Phân bổ jobs đến các worker một cách thông minh
- **Chiến lược cân bằng tải**:
  - `ROUND_ROBIN`: Phân bổ vòng lặp
  - `LEAST_CONNECTION`: Chọn worker có ít job đang xử lý nhất
  - `WEIGHTED`: Phân bổ theo trọng số (worker mạnh hơn nhận nhiều job hơn)
  - `HEALTH_BASED`: Chọn worker dựa trên chỉ số sức khỏe

**Cấu trúc Worker Node:**
```typescript
interface WorkerNode {
  workerId: string;        // ID duy nhất của worker
  queueName: string;       // Queue mà worker xử lý
  activeJobs: number;      // Số job đang xử lý
  totalProcessed: number;  // Tổng số job đã xử lý
  failureCount: number;    // Số lần thất bại
  avgProcessingTime: number; // Thời gian xử lý trung bình
  healthy: boolean;        // Trạng thái sức khỏe
  weight: number;          // Trọng số (cho weighted balancing)
}
```

#### 3.2.3 Worker Scaling Service (`worker-scaling.service.ts`)
- **Chức năng**: Tự động điều chỉnh số lượng worker dựa trên tải
- **Cơ chế hoạt động**:
  - **Scale Up**: Tăng worker khi queue bị đầy
  - **Scale Down**: Giảm worker khi queue thưa
  - **Cooldown**: Đợi khoảng thời gian giữa các lần scale

**Cấu hình scaling cho mỗi queue:**
```typescript
interface WorkerScalingConfig {
  queueName: string;
  minWorkers: number;      // Số worker tối thiểu
  maxWorkers: number;      // Số worker tối đa
  scaleUpThreshold: number; // Ngưỡng để tăng worker
  scaleDownThreshold: number; // Ngưỡng để giảm worker
  checkInterval: number;   // Khoảng thờing kiểm tra
  cooldownPeriod: number;  // Thời gian chờ giữa các lần scale
}
```

### 3.3 Ví dụ thực tế

#### 3.3.1 Xử lý đột biến đăng ký
Khi có nhiều học sinh nộp đơn cùng lúc:

1. **Requests đến**: 1000 yêu cầu/giây
2. **API nhận**: Đưa vào `verify_document` queue
3. **Queue xử lý**: Giữ requests với tốc độ 100 requests/giây
4. **Workers**: Tự động scale từ 2 lên 10 workers
5. **Kết quả**: Hệ thống không bị sập, tất cả requests được xử lý

#### 3.3.2 Cân bằng tải cho các loại công việc khác nhau

**Payment Processing (Ưu tiên cao):**
```typescript
// Cấu hình cho queue thanh toán
this.scalingConfigs.set('create_payment', {
  minWorkers: 3,
  maxWorkers: 15,
  scaleUpThreshold: 30,    // Nhạy hơn với tải
  scaleDownThreshold: 5,
  cooldownPeriod: 20000,   // Scale nhanh hơn
});
```

**Email Sending (Ưu tiên thấp):**
```typescript
// Cấu hình cho queue email
this.scalingConfigs.set('send_email', {
  minWorkers: 2,
  maxWorkers: 8,
  scaleUpThreshold: 100,   // Chịu tải tốt hơn
  scaleDownThreshold: 20,
  cooldownPeriod: 30000,   // Scale chậm hơn
});
```

## 4. Các chiến lược Load Leveling được sử dụng

### 4.1 Throttling (Giãn dòng)
- **Mục đích**: Giới hạn số lượng requests được xử lý
- **Triển khai**: Dùng Redis queue với rate limiting
- **Ví dụ**: Chỉ xử lý 100 document verification requests/giây

### 4.2 Prioritization (Ưu tiên)
- **Mục đích**: Xử lý các tác vụ quan trọng trước
- **Triển khai**: Job priorities trong Bull queue
- **Thứ tự ưu tiên**: Critical > High > Normal > Low

### 4.3 Load Balancing (Cân bằng tải)
- **Mục đích**: Phân bổ jobs đều giữa các workers
- **Triển khai**: WorkerLoadBalancerService với nhiều chiến lược
- **Chiến lược mặc định**: Health-based (dựa trên sức khỏe worker)

### 4.4 Auto-scaling (Tự động mở rộng)
- **Mục đích**: Điều chỉnh số lượng worker theo tải
- **Triển khai**: WorkerScalingService
- **Factors**: Queue depth, processing time, failure rate

## 5. Monitor và Metrics

### 5.1 Metrics quan trọng
- **Queue Depth**: Số jobs đang chờ trong queue
- **Processing Time**: Thời gian xử lý trung bình
- **Worker Health**: Tỷ lệ thành công/thất bại
- **Scaling Events**: Lịch sử scale up/down
- **Load Balancing Distribution**: Phân bổ jobs giữa workers

### 5.2 Dashboard monitoring
```typescript
// Ví dụ metrics trả về
interface LoadBalancingMetrics {
  strategy: LoadBalancingStrategy;
  totalJobsDistributed: number;
  distributionMap: Map<string, number>; // workerId → job count
  avgDistributionVariance: number;
  lastBalancingTime: Date;
}
```

## 6. Best Practices và Lessons Learned

### 6.1 Best Practices
1. **Set appropriate timeouts**: Không để jobs chạy quá lâu
2. **Implement retry logic**: Thử lại với exponential backoff
3. **Monitor queue depth**: Phát hiện sớm khi queue bị đầy
4. **Use dead letter queues (DLQ)**: Xử lý jobs thất bại
5. **Implement circuit breakers**: Ngăn gọi đến service đang lỗi

### 6.2 Common Pitfalls cần tránh
1. **Too many workers**: Tốn tài nguyên không cần thiết
2. **Too few workers**: Queue bị ùn ứ
3. **Ignoring failures**: Không xử lý jobs thất bại
4. **No monitoring**: Không biết hệ thống hoạt động ra sao

## 7. Kết luận

Queue-Based Load Leveling trong hệ thống University Admission Portal đã giúp:

1. **Stabilize Performance**: Hiệu suất ổn định dù traffic biến động
2. **Improve Reliability**: Giảm thiểu downtime và lỗi hệ thống
3. **Enable Scaling**: Dễ dàng mở rộng khi cần thiết
4. **Better User Experience**: Người dùng không gặp lỗi khi hệ thống tải cao

Kiến trúc này đặc biệt hữu ích cho các hệ thống có traffic không đều đặn và cần xử lý các tác vụ nền (background jobs) một cách đáng tin cậy.

Tuyệt vời\! Đây là bản chuyển đổi sang định dạng Markdown, được cấu trúc rõ ràng và dễ đọc hơn, nhấn mạnh vào các thành phần quan trọng của kiến trúc **Queue-Based Load Leveling** (Cân bằng tải dựa trên Hàng đợi) trong University Admission Portal.

# 🏛️ Kiến Trúc Queue-Based Load Leveling (Cổng Tuyển sinh Đại học)

Dựa trên phân tích codebase chi tiết, dưới đây là cách Queue-Based Load Leveling được cài đặt trong hệ thống University Admission Portal:

-----

## 1\. Cấu Trúc Tổng Thể

Hệ thống được thiết kế theo mô hình 3 lớp tích hợp, tách biệt các nhiệm vụ kinh doanh (Business Logic) khỏi việc xử lý nền (Background Processing) thông qua một lớp hàng đợi (Queue Layer) làm bộ đệm:

| Lớp | Chức năng Chính | Mô tả |
| :--- | :--- | :--- |
| **Application Layer** | Business Logic | Xử lý yêu cầu người dùng (User Request), thực hiện các giao dịch chính (e.g., tạo Application). |
| **Queue Layer** | Load Leveling | **Bull/Redis** đóng vai trò là hàng đợi, lưu trữ các tác vụ nền (jobs) để cân bằng tải và chịu lỗi. |
| **Worker Layer** | Processing | Các Worker độc lập (Consumers) tiêu thụ jobs từ hàng đợi và thực hiện các tác vụ tốn thời gian. |

-----

## 2\. Setup và Configuration Ban Đầu

Module cốt lõi cho việc thiết lập Queue là `feature-flags.module.ts`.

### Cấu hình Redis và Đăng ký Queues

Hệ thống sử dụng thư viện **Bull** (dựa trên Redis) để quản lý hàng đợi.

```typescript
// Cấu hình Redis cho queues
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
    },
  }),
}),

// Đăng ký 3 queues chính
BullModule.registerQueue(
  { name: 'verify_document' }, // Xác minh tài liệu
  { name: 'create_payment' },  // Xử lý thanh toán
  { name: 'send_email' },      // Gửi email
),
```

-----

## 3\. Flow từ User Request đến Queue Processing

### Step 1: User tạo Application (File: `applications.service.ts`)

Khi người dùng gửi đơn đăng ký, dịch vụ sẽ thực hiện giao dịch ACID cho Application chính và sử dụng **Outbox Pattern** để đảm bảo tính nhất quán:

  * Tạo Application và lưu Files trong DB.
  * Tạo **Outbox Messages** cho các sự kiện (ví dụ: `document_uploaded`).
  * **Sau khi Transaction hoàn tất**, **Queue Producer** (`queueProducerService`) sẽ thêm các Jobs vào queues.

<!-- end list -->

```typescript
// 4. Sau transaction, add jobs vào queues
if (validatedFiles.length > 0) {
  await this.queueProducerService.addVerifyDocumentJob( /* ... */ );
}

await this.queueProducerService.addCreatePaymentJob( /* ... */ );
```

### Step 2: Outbox Pattern Processing (File: `outbox-relay.service.ts`)

Một Worker/Service riêng biệt (`outbox-relay.service.ts`) định kỳ:

1.  Đọc các tin nhắn **chưa xử lý** (`processedAt: null`) từ bảng **Outbox**.
2.  Dựa trên `eventType` (`document_uploaded`, `payment_completed`), thêm các jobs tương ứng vào các queues Bull. Điều này **đảm bảo** rằng nếu việc thêm job queue lần đầu bị lỗi (ví dụ: network issue), Outbox Relay vẫn sẽ thử lại sau.

### Step 3: Worker Processing

Các **Workers** riêng biệt tiêu thụ jobs từ queues, thực hiện các tác vụ nặng:

| Worker | Queue | Tác vụ Chính |
| :--- | :--- | :--- |
| **Document Verification Worker** | `verify_document` | Cập nhật status, xử lý logic xác minh từng file. |
| **Payment Worker** | `create_payment` | Xử lý giao dịch thanh toán. |
| **Email Worker** | `send_email` | Gửi thông báo (email). |

```typescript
// Document Verification Worker (document-verification.worker.ts)
@Processor('verify_document')
export class DocumentVerificationWorker extends WorkerBase {
  @Process('verify_document')
  async processVerifyDocument(job: Job<VerifyDocumentJobData>) {
    /* ... logic xử lý xác minh tài liệu ... */
    await this.updateApplicationStatus(applicationId, 'verified');
  }
}
```

-----

## 4\. Load Leveling Components Integration

Các dịch vụ này được thiết kế để điều chỉnh việc xử lý jobs theo tải, đây là cốt lõi của **Load Leveling**:

  * **A. Worker Scaling Service:** Quản lý số lượng Worker instance.

| Queue | Cấu hình Scaling | Mục đích |
| :--- | :--- | :--- |
| `verify_document` | `minWorkers: 2, maxWorkers: 10, scaleUpThreshold: 50` | Mở rộng quy mô khi có **50 jobs đang chờ** để xử lý nhanh hơn. |
| `create_payment` | `minWorkers: 3, maxWorkers: 15, scaleUpThreshold: 30` | |
| `send_email` | `minWorkers: 2, maxWorkers: 8, scaleUpThreshold: 100` | |

  * **B. Worker Pool Service:** Quản lý **concurrency** (số job xử lý đồng thời trên mỗi worker) và **priority** (ưu tiên).

| Queue | Cấu hình Pool |
| :--- | :--- |
| `verify_document` | `concurrency: 3, priority: 1` |
| `create_payment` | `concurrency: 2, priority: 0` (Ưu tiên cao nhất) |
| `send_email` | `concurrency: 5, priority: 2` |

  * **C. Load Balancer Service:** (Chủ yếu áp dụng cho việc phân bổ jobs đến các Worker instances nếu kiến trúc có nhiều Worker, hoặc điều chỉnh Bull Queue)

<!-- end list -->

```typescript
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round-robin',
  LEAST_CONNECTION = 'least-connection',
  WEIGHTED = 'weighted',
  HEALTH_BASED = 'health-based',
}
```

-----

## 5\. Reliability Components

Các mẫu thiết kế này được sử dụng để tăng cường khả năng phục hồi của hệ thống (resilience) trước các lỗi.

| Thành phần | File | Mô tả |
| :--- | :--- | :--- |
| **A. Bulkhead Isolation** | `bulkhead.service.ts` | Giới hạn **concurrent jobs** cho mỗi loại Queue (`verify_document: max 3 jobs`) để tránh một loại tác vụ quá tải làm sập toàn bộ hệ thống. |
| **B. Circuit Breaker** | `circuit-breaker.service.ts` | Theo dõi tỷ lệ lỗi của Worker. Nếu lỗi quá cao, ngắt mạch (**OPEN**), chuyển sang trạng thái **HALF\_OPEN** để thử lại, ngăn chặn **cascade failures**. |
| **C. Dead Letter Queue (DLQ)** | `dlq.service.ts` | Xử lý các jobs bị thất bại vĩnh viễn (ví dụ: sau N lần thử lại). Cung cấp API `requeueJob()` để thử lại thủ công. |

-----

## 7\. Admin Control

Hệ thống cung cấp các điểm cuối (endpoints) cho quản trị viên để theo dõi và kiểm soát các thành phần Load Leveling:

  * `/admin/workers/scaling/metrics`
  * `/admin/workers/pools/stats`
  * `/admin/workers/load-balancer/strategy`
  * `/admin/workers/dashboard` (Tổng quan hoàn chỉnh)

-----

## 💡 Tóm Tắt Cách Hoạt Động

1.  **User submits application** → Business logic xử lý (Application Layer).
2.  **Outbox Pattern** → Đảm bảo reliability, tạo jobs trong DB (Application Layer).
3.  **Queue Producer** → Convert events thành queue jobs trong Redis/Bull (Queue Layer).
4.  **Load Leveling** → Scaling, load balancing, bulkhead isolation (Queue/Worker Layer).
5.  **Workers** → Process jobs với reliability features (Worker Layer).
6.  **Monitoring** → Real-time metrics và admin control.

Kiến trúc này giúp hệ thống xử lý **load cao** một cách **đáng tin cậy**, có thể **scale tự động**, và được **giám sát toàn diện**.

-----

Would you like to explore the code implementation details for a specific component, like the **Outbox Pattern** or the **Worker Scaling Service**?