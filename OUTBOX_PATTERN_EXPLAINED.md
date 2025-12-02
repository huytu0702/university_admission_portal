# Outbox Pattern - Giải Thích Chi Tiết

## Vấn Đề: Tại Sao Cần Outbox?

### Tình Huống Nguy Hiểm Trong Hệ Thống Phân Tán

#### ❌ **Cách Làm Sai (Synchronous)**

```typescript
async submitApplication(userId: string, data: any) {
  // Bước 1: Lưu vào database
  const app = await db.application.create({
    data: { userId, status: 'submitted' }
  });

  // Bước 2: Gửi job vào queue
  await queue.add('verify-document', {
    applicationId: app.id
  });

  return app;
}
```

**Các vấn đề có thể xảy ra:**

| Kịch Bản | Kết Quả | Hậu Quả |
|---------|--------|--------|
| Application lưu ✅ → Queue gửi thất bại ❌ | Dữ liệu trong DB nhưng job bị mất | Application bị mắc kẹt, không ai xử lý |
| Application lưu thất bại ❌ → Queue gửi ✅ | Job vào queue nhưng không có dữ liệu | Worker crash vì không tìm thấy application |
| Server crash giữa 2 bước | Dữ liệu không nhất quán | Data integrity violation |

**Ví dụ thực tế:**
```
Thời gian t=0: Lưu application vào DB → Thành công
Thời gian t=0.1s: Server gửi job vào Redis queue
Thời gian t=0.2s: ⚡ Server crash! (power outage)

Kết quả:
- Application đã lưu trong DB → tồn tại
- Job BẮT ĐẦU được gửi nhưng Redis disconnect → job KHÔNG được lưu
- Application chờ mãi không ai xử lý
- User submit rồi mà ứng dụng stuck ở status "submitted"
```

---

## ✅ **Giải Pháp: Outbox Pattern**

### Khái Niệm

**Outbox = "Hộp thư đi"**

Thay vì gửi message trực tiếp sang hệ thống bên ngoài, ta:
1. Lưu message vào một bảng **Outbox** chung trong cùng database transaction
2. Một **relay service** chạy periodically để đọc Outbox
3. Relay gửi messages vào queue từ từ, đảm bảo consistency

### Schema

```sql
CREATE TABLE Outbox (
  id         UUID PRIMARY KEY,
  eventType  VARCHAR(100),
  payload    TEXT (JSON),
  processedAt TIMESTAMP NULL,
  createdAt  TIMESTAMP DEFAULT NOW()
);
```

**3 trạng thái của message:**
- `processedAt IS NULL` → Chưa xử lý
- `processedAt IS NOT NULL` → Đã gửi thành công

---

## Ví Dụ Thực Tế: Hệ Thống Đăng Ký Đại Học

### Sơ Đồ Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User click "Submit Application"                              │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
        ┌─────────────────────┐
        │ Create Application  │
        │ + Store Files       │
        │ + Create Outbox Msg │ ← ATOMIC TRANSACTION
        │                     │   (Tất cả hoặc không cái nào)
        └─────────────────────┘
                  ↓
        ┌─────────────────────────────────────┐
        │ Return 202 ACCEPTED                 │
        │ statusUrl: /app/{id}/status         │
        │ Client: "Cảm ơn, đang xử lý..."     │
        └─────────────────────────────────────┘
                  ↓
        ┌──────────────────────────────────────────┐
        │ BACKGROUND PROCESSING (Không ảnh hưởng  │
        │ client experience)                       │
        ├──────────────────────────────────────────┤
        │ Every 2 seconds:                         │
        │ 1. OutboxRelayScheduler triggers         │
        │ 2. Relay reads unprocessed Outbox msgs   │
        │ 3. For each message:                     │
        │    - Route to appropriate queue          │
        │    - If success: mark processedAt        │
        │    - If fail: retry later (DLQ)          │
        │ 4. Workers process jobs from queues      │
        │ 5. Update application status             │
        └──────────────────────────────────────────┘
                  ↓
        ┌──────────────────────┐
        │ User polls status API │
        │ to track progress     │
        └──────────────────────┘
```

---

## Code Chi Tiết: Application Submission

### Bước 1: Lưu Application + Outbox Messages (ATOMIC)

**File: `applications.service.ts` (dòng 63-112)**

```typescript
async createApplication(userId: string, dto: CreateApplicationDto) {
  // ⚠️ KỲ QUAN: Tất cả hoặc không cái nào!
  const application = await this.prisma.$transaction(async (tx) => {
    
    // ===== Bước A: Tạo Application =====
    const newApplication = await tx.application.create({
      data: {
        userId,
        personalStatement: dto.personalStatement,
        status: 'submitted',
        progress: 25,
      },
    });

    // ===== Bước B: Lưu Files (nếu có) =====
    if (validatedFiles.length > 0) {
      for (const file of validatedFiles) {
        await tx.applicationFile.create({
          data: {
            applicationId: newApplication.id,
            fileName: file.originalName,
            fileType: file.mimeType,
            fileSize: file.size,
            filePath: file.path,
          },
        });
      }
    }

    // ===== Bước C: TẠO OUTBOX MESSAGE CHO DOCUMENT VERIFICATION =====
    if (validatedFiles.length > 0) {
      await tx.outbox.create({
        data: {
          eventType: 'document_uploaded',  // ← Loại sự kiện
          payload: JSON.stringify({
            applicationId: newApplication.id,
            applicationFileIds: validatedFiles.map(f => f.path),
          }),
          // processedAt: null ← Mặc định, chưa xử lý
        },
      });
    }

    // ===== Bước D: TẠO OUTBOX MESSAGE CHO PAYMENT =====
    await tx.outbox.create({
      data: {
        eventType: 'application_submitted',  // ← Loại sự kiện
        payload: JSON.stringify({
          applicationId: newApplication.id,
        }),
      },
    });

    return newApplication;
  });

  // 🎯 Đến đây, nếu có lỗi ở bất kỳ bước nào (A-D),
  //    tất cả đều được rollback. Database vẫn clean.
  
  return {
    applicationId: application.id,
    statusUrl: `/applications/${application.id}/status`,
    payUrl: `/payments/checkout/${application.id}`,
  };
}
```

**Trong database sau khi thực thi:**

```sql
-- Bảng Applications
INSERT INTO "Application" 
  (id, userId, status, progress, createdAt)
VALUES 
  ('app-123', 'user-456', 'submitted', 25, NOW());

-- Bảng ApplicationFile
INSERT INTO "ApplicationFile" 
  (id, applicationId, fileName, ...)
VALUES 
  ('file-1', 'app-123', 'resume.pdf', ...),
  ('file-2', 'app-123', 'transcript.pdf', ...);

-- 🔑 Bảng Outbox - QUAN TRỌNG
INSERT INTO "Outbox" 
  (id, eventType, payload, processedAt, createdAt)
VALUES 
  (
    'msg-1',
    'document_uploaded',
    '{"applicationId":"app-123","applicationFileIds":["uploads/..."]}'
    NULL,  -- Chưa xử lý
    NOW()
  ),
  (
    'msg-2',
    'application_submitted',
    '{"applicationId":"app-123"}',
    NULL,  -- Chưa xử lý
    NOW()
  );
```

---

### Bước 2: OutboxRelayScheduler Chạy Định Kỳ

**File: `outbox-relay.scheduler.ts`**

```typescript
@Injectable()
export class OutboxRelayScheduler implements OnModuleInit {
  constructor(private outboxRelayService: OutboxRelayService) {}

  async onModuleInit() {
    // Chạy lần đầu khi server start
    await this.processOutboxMessages();
  }

  @Cron('*/2 * * * * *') // ⏰ Mỗi 2 giây
  async handleCron() {
    console.log('[' + new Date().toISOString() + '] Running outbox relay...');
    await this.processOutboxMessages();
  }

  private async processOutboxMessages() {
    try {
      await this.outboxRelayService.processOutbox();
    } catch (error) {
      console.error('Error processing outbox:', error);
    }
  }
}
```

**Log output:**
```
[2024-01-15T10:30:00.000Z] Running outbox relay...
[2024-01-15T10:30:02.000Z] Running outbox relay...
[2024-01-15T10:30:04.000Z] Running outbox relay...
```

---

### Bước 3: Relay Service Xử Lý Messages

**File: `outbox-relay.service.ts`**

```typescript
@Injectable()
export class OutboxRelayService {
  constructor(
    private prisma: PrismaService,
    private queueProducerService: QueueProducerService,
  ) {}

  async processOutbox(): Promise<void> {
    // 🔍 Bước 1: Lấy tất cả unprocessed messages (batch 100)
    const outboxMessages = await this.prisma.outbox.findMany({
      where: { processedAt: null },  // ← Chỉ lấy chưa xử lý
      orderBy: { createdAt: 'asc' },  // ← Xử lý theo thứ tự cũ trước
      take: 100,  // ← Batch size để avoid memory issues
    });

    console.log(`Found ${outboxMessages.length} unprocessed messages`);

    // 🔄 Bước 2: Duyệt từng message
    for (const message of outboxMessages) {
      try {
        // 📤 Bước 2a: Route message đến queue đúng
        await this.processMessage(message);
        
        // ✅ Bước 2b: Mark as processed (chỉ sau khi queue accept)
        await this.prisma.outbox.update({
          where: { id: message.id },
          data: { processedAt: new Date() },
        });

        console.log(`✅ Message ${message.id} processed successfully`);
      } catch (error) {
        // ❌ Bước 2c: Lỗi → retry lần tới
        console.error(`❌ Message ${message.id} failed: ${error.message}`);
        // Message vẫn processedAt = null → sẽ retry sau 2 giây
      }
    }
  }

  // 🎯 Hàm route message theo loại sự kiện
  private async processMessage(message: any): Promise<void> {
    const payload = JSON.parse(message.payload);
    
    switch (message.eventType) {
      // 📄 Sự kiện: Documents được upload
      case 'document_uploaded':
        await this.queueProducerService.addVerifyDocumentJob(
          `verify_${message.id}`,
          payload,
          'normal'
        );
        console.log(`→ Routed to verify_document queue`);
        break;

      // 💳 Sự kiện: Application được submit
      case 'application_submitted':
        await this.queueProducerService.addCreatePaymentJob(
          `payment_${message.id}`,
          payload,
          'normal'
        );
        console.log(`→ Routed to create_payment queue`);
        break;

      // 📧 Sự kiện: Payment hoàn tất
      case 'payment_completed':
        await this.queueProducerService.addSendEmailJob(
          `email_${message.id}`,
          payload,
          'normal'
        );
        console.log(`→ Routed to send_email queue`);
        break;

      default:
        console.warn(`⚠️ Unknown event type: ${message.eventType}`);
    }
  }
}
```

---

## Ví Dụ Timeline: Điều Gì Xảy Ra Từng Giây

### Kịch Bản: User Submit Application Lúc 10:30:00

```
TIME         EVENT                                    DB STATE
────────────────────────────────────────────────────────────────

10:30:00     User click "Submit"
             ↓
             API receives POST /applications
             
10:30:00.1   1️⃣ Validate files
             2️⃣ Transaction starts
             
10:30:00.2   3️⃣ INSERT Application
             Status: submitted, Progress: 25
             
10:30:00.3   4️⃣ INSERT 2 ApplicationFiles
             file: resume.pdf, transcript.pdf
             
10:30:00.4   5️⃣ INSERT Outbox[0]
             eventType: document_uploaded
             processedAt: NULL
             
10:30:00.5   6️⃣ INSERT Outbox[1]
             eventType: application_submitted
             processedAt: NULL
             
10:30:00.6   ✅ TRANSACTION COMMIT
             All or nothing!
             
10:30:00.7   Return 202 ACCEPTED
             Client: "OK, processing..."
             
10:30:02     OutboxRelayScheduler triggers
             SELECT * FROM Outbox WHERE processedAt IS NULL
             ↓ Found 2 messages
             
10:30:02.1   For Outbox[0] (document_uploaded):
             → Queue: verify_document
             → Job: verify_doc_msg1
             ✓ Job enqueued
             
10:30:02.2   UPDATE Outbox[0]
             SET processedAt = 2024-01-15 10:30:02
             
10:30:02.3   For Outbox[1] (application_submitted):
             → Queue: create_payment
             → Job: payment_msg2
             ✓ Job enqueued
             
10:30:02.4   UPDATE Outbox[1]
             SET processedAt = 2024-01-15 10:30:02
             
10:30:02.5   ✅ All outbox messages processed
             SELECT * FROM Outbox WHERE processedAt IS NULL
             ↓ EMPTY!
             
10:30:05     Worker 1 picks up "verify_document" job
             - Read files from storage
             - Run OCR/validation
             - If passed: mark verified
             
10:30:10     UPDATE Application
             Status: verified, Progress: 50
             
10:30:10     Worker 2 picks up "create_payment" job
             - Create payment record
             - Generate payment intent
             
10:30:12     UPDATE Application
             Status: awaiting_payment, Progress: 75
             
10:30:XX     User polls GET /applications/{id}/status
             ↓ Returns { status: "awaiting_payment", progress: 75 }
             
10:35:00     User completes payment
             ↓ Payment webhook
             
10:35:01     INSERT Outbox[2]
             eventType: payment_completed
             
10:35:04     OutboxRelayScheduler processes Outbox[2]
             → Queue: send_email
             
10:35:05     Worker 3 picks up "send_email" job
             - Send confirmation email
             
10:35:10     UPDATE Application
             Status: completed, Progress: 100
```

---

## Lợi Ích: Tại Sao Cần Outbox?

### 1. **Atomicity (Tính Nguyên Tố)**

```
❌ Không có Outbox:
   Application INSERT ✅
   Queue.add() ❌ (Redis disconnect)
   → Inconsistent state!

✅ Có Outbox:
   Application INSERT ✅
   Outbox INSERT ✅
   COMMIT ✅ (Cùng transaction!)
   Queue.add() ❌ (Redis disconnect)
   → Dữ liệu vẫn consistent, sẽ retry sau 2s
```

### 2. **Durability (Tính Bền Vững)**

```
❌ Không có Outbox:
   Application saved
   Queue message sent
   Server crash
   → Message LOST! Application stuck forever

✅ Có Outbox:
   Application + Outbox saved (1 transaction)
   Server crash
   Server restarts
   RelayScheduler reads unprocessed Outbox
   → Message FOUND & PROCESSED!
```

### 3. **Decoupling (Giảm Bớt Coupling)**

```
❌ Tight coupling:
   app.service.ts directly calls queue.add()
   If queue down → API fails → User gets 500

✅ Loose coupling:
   app.service.ts writes to Outbox only
   API returns 202 immediately
   RelayScheduler asynchronously processes Outbox
   If queue down → API still works → Data safe in Outbox
```

---

## Các Trường Hợp Failure & Cách Recovery

### Case 1: Server Crash Giữa Outbox Processing

```
Timeline:
10:30:02.1  Relay read Outbox[0]
10:30:02.2  Relay routed to queue ✅
10:30:02.3  Relay tries UPDATE Outbox[0] processedAt
10:30:02.3.5 💥 SERVER CRASH!

Recovery:
10:30:05    Server restarts
10:30:06    OutboxRelayScheduler.onModuleInit()
            SELECT * FROM Outbox WHERE processedAt IS NULL
            ↓ Found Outbox[0] (stuck in partial state)
            
            But queue already has the job? 
            → BullMQ deduplication by jobId:
              addVerifyDocumentJob('verify_msg1', ...) 
              ↓ Job ID is deterministic
              ↓ Won't create duplicate!
```

### Case 2: Job Processing Fails Permanently

```
Retry strategy in QueueProducerService:
  attempts: 3
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  }

Timeline:
Attempt 1: Worker fails → Retry after 2s
Attempt 2: Worker fails → Retry after 4s  
Attempt 3: Worker fails → Mark as FAILED (DLQ)

Outbox message: processedAt IS NOT NULL
(Because we only mark after queue.add() succeeds)

⚠️ Manual intervention needed:
- Check DLQ for failed jobs
- Fix the issue
- Manually retry
```

### Case 3: Network Partition Between Service & Queue

```
Timeline:
10:30:02.1  Relay calls queueProducerService.add()
10:30:02.2  Network cut ⚡
10:30:02.3  Queue.add() times out/fails → Error thrown
10:30:02.4  Relay catches error, doesn't mark processedAt
10:30:02.5  Transaction doesn't commit

Recovery:
10:30:04    Network restored
10:30:06    OutboxRelayScheduler retry
            SELECT * FROM Outbox WHERE processedAt IS NULL
            ↓ Found the message again!
            ↓ Retry queue.add()
            ✓ Success this time!
```

---

## Monitoring & Observability

```typescript
// Log nên track:
console.log(`[Outbox] Found ${count} unprocessed messages`);
console.log(`[Outbox] Processing message: ${message.id} (${message.eventType})`);
console.log(`[Outbox] ✅ Processed: ${message.id}`);
console.error(`[Outbox] ❌ Failed: ${message.id}: ${error.message}`);

// Metrics:
gauge('outbox.pending.count', unprocessedCount);  // Should be ~0
gauge('outbox.processing.duration', elapsed);      // Should be < 100ms per message
counter('outbox.processed.total', 1);
counter('outbox.failed.total', 1);  // Needs alert!
```

---

## Tóm Tắt

| Khía Cạnh | Không Outbox | Có Outbox |
|-----------|-------------|----------|
| **Database + Queue Sync** | ❌ Risky | ✅ Atomic Transaction |
| **Server Crash During Relay** | ❌ Message lost | ✅ Retry automatically |
| **Queue Down** | ❌ API fails | ✅ API still works, retry later |
| **Deduplication** | ❌ Possible duplicates | ✅ Deterministic jobId |
| **Monitoring** | ❌ Hard to debug | ✅ Easy: check Outbox table |
| **Consistency Guarantee** | ❌ Eventually inconsistent | ✅ Guaranteed consistency |

**Outbox = "Fire and Forget" Pattern Done Right!** 🎯
