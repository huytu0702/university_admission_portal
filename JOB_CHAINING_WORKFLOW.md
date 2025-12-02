# Sequential Job Chaining Workflow

## Tổng Quan

Hệ thống hiện nay đã được update để sử dụng **Sequential Job Chaining** - mỗi job hoàn tất sẽ trigger job tiếp theo thay vì enqueue hết cùng lúc.

---

## Workflow Chi Tiết

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER SUBMIT APPLICATION                                             │
└────────────────┬────────────────────────────────────────────────────┘
                 ↓
         ┌──────────────────┐
         │ API Layer (Fast) │
         └────────┬─────────┘
                  ↓
    [TRANSACTION - ATOMIC]
    ├─ INSERT Application
    ├─ INSERT ApplicationFiles (if any)
    ├─ INSERT Outbox[0] (eventType: 'document_uploaded')
    └─ COMMIT ✅
                  ↓
    Return 202 ACCEPTED ← User gets response in 0.37s!
                  ↓
         ┌──────────────────────────────────┐
         │ BACKGROUND PROCESSING (Async)    │
         └────────┬─────────────────────────┘
                  ↓
    ┌──────────────────────────────────────┐
    │ OutboxRelayScheduler (Every 2s)      │
    │ Detects: Outbox[0] (document_uploaded)
    └────────┬─────────────────────────────┘
             ↓
    [IF files exist]
    └─ Enqueue Job: verify_document
                  ↓
              [WORKER]
         ┌──────────────────┐
         │ verify_document  │
         │  Worker picks job
         └────────┬─────────┘
                  ↓
         ├─ Update status: verifying
         ├─ Read files from storage
         ├─ Run OCR/validation (3-5 seconds)
         ├─ Save results to DB
         ├─ Update status: verified ✅ (or verification_failed ❌)
         └─ Emit event: document_verified
                  ↓
             [OUTBOX]
         INSERT Outbox[1]
         eventType: 'document_verified'
         processedAt: NULL
                  ↓
    ┌──────────────────────────────────────┐
    │ OutboxRelayScheduler (Next 2s cycle) │
    │ Detects: Outbox[1] (document_verified)
    └────────┬─────────────────────────────┘
             ↓
    [ONLY IF verification succeeded]
    └─ Enqueue Job: create_payment
                  ↓
              [WORKER]
         ┌──────────────────┐
         │ create_payment   │
         │  Worker picks job
         └────────┬─────────┘
                  ↓
         ├─ Update status: processing_payment
         ├─ Create payment record (2-3 seconds)
         ├─ Generate payment intent
         ├─ Update status: payment_initiated ✅ (or payment_failed ❌)
         └─ Emit event: payment_completed
                  ↓
             [OUTBOX]
         INSERT Outbox[2]
         eventType: 'payment_completed'
         processedAt: NULL
                  ↓
    ┌──────────────────────────────────────┐
    │ OutboxRelayScheduler (Next 2s cycle) │
    │ Detects: Outbox[2] (payment_completed)
    └────────┬─────────────────────────────┘
             ↓
    [ONLY IF payment succeeded]
    └─ Enqueue Job: send_email
                  ↓
              [WORKER]
         ┌──────────────────┐
         │  send_email      │
         │  Worker picks job
         └────────┬─────────┘
                  ↓
         ├─ Get application & user
         ├─ Send confirmation email (1-2 seconds)
         ├─ Update status: email_sent ✅ (or email_failed ❌)
         └─ Emit event: email_sent
                  ↓
             [OUTBOX]
         INSERT Outbox[3]
         eventType: 'email_sent'
         processedAt: NULL
                  ↓
    ┌──────────────────────────────────────┐
    │ OutboxRelayScheduler (Next 2s cycle) │
    │ Detects: Outbox[3] (email_sent)      │
    └────────┬─────────────────────────────┘
             ↓
         UPDATE Application
         ├─ status: 'completed'
         ├─ progress: 100
         └─ updatedAt: NOW()
                  ↓
    ✅ WORKFLOW COMPLETE!
```

---

## Code Changes

### 1. Applications Service (Only enqueue first job)

**File: `applications.service.ts` (Lines 114-136)**

```typescript
// BEFORE: Enqueue all 3 jobs at once
await this.queueProducerService.addVerifyDocumentJob(...);
await this.queueProducerService.addCreatePaymentJob(...);

// AFTER: Only enqueue first job (verify)
// Payment & email will be enqueued automatically when previous jobs complete
if (validatedFiles.length > 0) {
  await this.queueProducerService.addVerifyDocumentJob(
    `verify-${application.id}`,
    { applicationId: application.id, applicationFileIds: validatedFiles.map(f => f.path) }
  );
} else {
  // If no files, skip verify and create document_verified event
  // This triggers payment job directly
  await this.prisma.outbox.create({
    data: {
      eventType: 'document_verified',
      payload: JSON.stringify({ applicationId: application.id }),
    },
  });
}
```

**Key:** Only enqueue `verify_document` job. Next jobs will be enqueued automatically.

---

### 2. Document Verification Worker (Emit event on success)

**File: `document-verification.worker.ts` (Lines 49-63)**

```typescript
// After successful verification
await this.updateApplicationStatus(applicationId, 'verified');

// Emit event to trigger next job
await this.prisma.outbox.create({
  data: {
    eventType: 'document_verified',
    payload: JSON.stringify({
      applicationId: applicationId,
    }),
  },
});
this.logger.log(`Emitted document_verified event for app: ${applicationId}`);
```

**Key:** When verification completes successfully, create an Outbox event that will trigger the payment job.

---

### 3. Payment Processing Worker (Emit event on success)

**File: `payment-processing.worker.ts` (Lines 35-49)**

```typescript
// After successful payment
await this.updateApplicationStatus(applicationId, 'payment_initiated');

// Emit event to trigger next job
await this.prisma.outbox.create({
  data: {
    eventType: 'payment_completed',
    payload: JSON.stringify({
      applicationId: applicationId,
    }),
  },
});
this.logger.log(`Emitted payment_completed event for app: ${applicationId}`);
```

**Key:** When payment completes successfully, create an Outbox event that will trigger the email job.

---

### 4. Email Sending Worker (Emit final event)

**File: `email-sending.worker.ts` (Lines 50-64)**

```typescript
// After successful email
await this.updateApplicationStatus(applicationId, 'email_sent');

// Emit event to mark workflow complete
await this.prisma.outbox.create({
  data: {
    eventType: 'email_sent',
    payload: JSON.stringify({
      applicationId: applicationId,
    }),
  },
});
this.logger.log(`Emitted email_sent event for app: ${applicationId}`);
```

**Key:** When email completes successfully, create an Outbox event to trigger final status update.

---

### 5. Outbox Relay Service (Route events to jobs)

**File: `outbox-relay.service.ts` (Lines 39-90)**

```typescript
private async processMessage(message: any): Promise<void> {
  const payload = JSON.parse(message.payload);
  
  switch (message.eventType) {
    // Step 1: Document uploaded → Start verification
    case 'document_uploaded':
      await this.queueProducerService.addVerifyDocumentJob(...);
      break;

    // Step 2: Documents verified → Start payment (ONLY after verify succeeds)
    case 'document_verified':
      await this.queueProducerService.addCreatePaymentJob(...);
      break;

    // Step 3: Payment completed → Start email (ONLY after payment succeeds)
    case 'payment_completed':
      await this.queueProducerService.addSendEmailJob(...);
      break;

    // Step 4: Email sent → Mark application complete
    case 'email_sent':
      await this.prisma.application.update({
        where: { id: payload.applicationId },
        data: { 
          status: 'completed',
          progress: 100,
          updatedAt: new Date(),
        },
      });
      break;

    default:
      this.logger.warn(`Unknown event type: ${message.eventType}`);
  }
}
```

**Key:** Each Outbox event triggers the appropriate next step. Sequential execution is guaranteed.

---

## Event Flow Timeline

```
TIME         EVENT                              OUTBOX TABLE STATE
──────────────────────────────────────────────────────────────────

10:30:00     User submits app
10:30:00.2   INSERT Application + Outbox[0]
10:30:00.3   Return 202 ACCEPTED

             Outbox[0]: eventType='document_uploaded', processedAt=NULL

10:30:02     OutboxRelayScheduler triggers
10:30:02.1   Process Outbox[0] → Enqueue verify job
10:30:02.2   UPDATE Outbox[0] SET processedAt=NOW
10:30:02.3   Outbox[0] done!

             Outbox[0]: eventType='document_uploaded', processedAt=2024-01-15 10:30:02

10:30:04     verify_document worker picks job
10:30:07     Verification complete ✅
10:30:07.1   UPDATE Application status='verified'
10:30:07.2   INSERT Outbox[1] (document_verified)

             Outbox[1]: eventType='document_verified', processedAt=NULL

10:30:08     OutboxRelayScheduler triggers
10:30:08.1   Process Outbox[1] → Enqueue payment job
10:30:08.2   UPDATE Outbox[1] SET processedAt=NOW

             Outbox[1]: eventType='document_verified', processedAt=2024-01-15 10:30:08

10:30:10     create_payment worker picks job
10:30:12     Payment complete ✅
10:30:12.1   UPDATE Application status='payment_initiated'
10:30:12.2   INSERT Outbox[2] (payment_completed)

             Outbox[2]: eventType='payment_completed', processedAt=NULL

10:30:14     OutboxRelayScheduler triggers
10:30:14.1   Process Outbox[2] → Enqueue email job
10:30:14.2   UPDATE Outbox[2] SET processedAt=NOW

             Outbox[2]: eventType='payment_completed', processedAt=2024-01-15 10:30:14

10:30:16     send_email worker picks job
10:30:18     Email sent ✅
10:30:18.1   UPDATE Application status='email_sent'
10:30:18.2   INSERT Outbox[3] (email_sent)

             Outbox[3]: eventType='email_sent', processedAt=NULL

10:30:20     OutboxRelayScheduler triggers
10:30:20.1   Process Outbox[3] → Update app to 'completed'
10:30:20.2   UPDATE Application status='completed', progress=100
10:30:20.3   UPDATE Outbox[3] SET processedAt=NOW

             Outbox[3]: eventType='email_sent', processedAt=2024-01-15 10:30:20

✅ APPLICATION WORKFLOW COMPLETE!
```

---

## Failure Scenarios

### Scenario 1: Verification Fails

```
Timeline:
10:30:04   verify_document worker picks job
10:30:07   Verification fails ❌
10:30:07.1 UPDATE Application status='verification_failed'
10:30:07.2 NO Outbox event created! (exception not caught)
           
Result:
- Application status: verification_failed
- No payment job enqueued ✅ (correct!)
- No email sent ✅ (correct!)
- Workflow stops at verification step ✅

User can:
- See status: "verification_failed"
- Reupload documents
- Restart workflow manually
```

### Scenario 2: Payment Fails

```
Timeline:
10:30:10   create_payment worker picks job
10:30:12   Payment fails ❌
10:30:12.1 UPDATE Application status='payment_failed'
10:30:12.2 NO Outbox event created!

Result:
- Application status: payment_failed
- Verification already done ✅
- No email sent ✅ (correct!)
- Workflow stops at payment step ✅

User can:
- See status: "payment_failed"
- Retry payment
- Restart workflow manually
```

### Scenario 3: Email Fails (But Payment Succeeded)

```
Timeline:
10:30:16   send_email worker picks job
10:30:18   Email fails ❌
10:30:18.1 UPDATE Application status='email_failed'
10:30:18.2 NO Outbox event created!

Result:
- Application status: email_failed
- Documents verified ✅
- Payment completed ✅
- Email NOT sent ❌
- Auto-retry by Bull (2 attempts)

If retry fails:
- Move to Dead Letter Queue (DLQ)
- Manual intervention needed
- But application data is safe!
```

---

## Advantages Over Parallel Processing

### ✅ Guaranteed Sequential Execution

```
❌ Parallel (Wrong):
App submit
├─ Job A: verify (3s)
├─ Job B: payment (2s) ← Starts immediately! Might run before A finishes!
└─ Job C: email (1s) ← Might run before B finishes!

Problem: Payment starts before verification completes!

✅ Sequential (Correct):
App submit
├─ Job A: verify (3s)
│  └─ On success: Emit event
│     ↓
├─ Job B: payment (2s) ← Starts AFTER A finishes!
│  └─ On success: Emit event
│     ↓
└─ Job C: email (1s) ← Starts AFTER B finishes!
```

### ✅ Proper Error Handling

```
❌ Parallel:
Payment starts (might succeed)
↓
Verification fails (too late!)
↓
Payment succeeded but application data invalid
↓
Inconsistent state! 😱

✅ Sequential:
Verification starts
↓
Verification fails
↓
NO payment job enqueued
↓
Application state consistent ✅
```

### ✅ Data Consistency

```
❌ Parallel:
- Payment might create record before documents verified
- Data in inconsistent state
- Hard to debug

✅ Sequential:
- Each job only runs after previous step succeeded
- Data always consistent
- Easy to track progress
```

### ✅ Queue-Based Load Leveling Still Works!

```
Peak hours (1000 users submit):

API:
├─ 1000 requests enqueue verify jobs (3.7 seconds total)
├─ All users get 202 response ✅
└─ API threads freed immediately ✅

Workers (process sequentially but in parallel across users):
├─ Workers 1-100: verify user 1-100 (3s)
├─ Workers 101-150: payment user 1-50 (2s) [parallel!]
├─ Workers 151-200: email user 1-50 (1s) [parallel!]

Total worker time: ~5 seconds (not 6 seconds!)
Why? Because while Worker 1 verifies User 1,
Worker 2 already finished and can start payment for User 1!
```

---

## Monitoring & Observability

### What to Track

```sql
-- Check Outbox table for processing status
SELECT 
  id,
  eventType,
  processedAt,
  createdAt,
  TIMESTAMPDIFF(SECOND, createdAt, processedAt) as processTime_sec
FROM Outbox
ORDER BY createdAt DESC
LIMIT 10;

-- Example output:
┌──────┬──────────────────────┬─────────────────────────┬─────────────────┬──────────────┐
│ id   │ eventType            │ processedAt             │ createdAt       │ processTime  │
├──────┼──────────────────────┼─────────────────────────┼─────────────────┼──────────────┤
│ msg4 │ email_sent           │ 2024-01-15 10:30:20     │ 10:30:18        │ 2           │
│ msg3 │ payment_completed    │ 2024-01-15 10:30:14     │ 10:30:12        │ 2           │
│ msg2 │ document_verified    │ 2024-01-15 10:30:08     │ 10:30:07        │ 1           │
│ msg1 │ document_uploaded    │ 2024-01-15 10:30:02     │ 10:30:00        │ 2           │
└──────┴──────────────────────┴─────────────────────────┴─────────────────┴──────────────┘

-- Check unprocessed messages (should be near 0)
SELECT COUNT(*) as pending_count
FROM Outbox
WHERE processedAt IS NULL
ORDER BY createdAt;
-- Expected: <= 10 (normal, being processed)
-- Alert if > 100! (Relay is slow or crashed)

-- Check application status distribution
SELECT status, COUNT(*) as count
FROM Application
GROUP BY status
ORDER BY count DESC;

-- Example:
┌──────────────────┬────────┐
│ status           │ count  │
├──────────────────┼────────┤
│ completed        │ 950    │  ✅
│ payment_failed   │ 30     │  Check payment service
│ verification_failed │ 15  │  Check verification service
│ submitted        │ 5      │  Normal (just started)
└──────────────────┴────────┘
```

### Metrics to Monitor

```
✅ Good Metrics:
- Outbox pending count: 0-10 (being processed)
- Outbox processing latency: 1-5 seconds per event
- Application completion rate: > 95% should complete within 30s
- Email success rate: > 98%

⚠️ Warning Signs:
- Outbox pending count: > 100 (Relay overwhelmed)
- Outbox processing latency: > 10s (Something slow)
- Payment failures: > 5% (Payment service issue)
- Email failures: > 2% (Email service issue)
- Applications stuck in 'verifying': Too many to process
```

---

## Summary

| Aspect | Before (Parallel) | After (Sequential) |
|--------|---|---|
| **Job Order** | All at once ❌ | One by one ✅ |
| **Data Consistency** | Risky ❌ | Safe ✅ |
| **Error Handling** | Hard ❌ | Easy ✅ |
| **Queue Benefits** | Full ✅ | Full ✅ |
| **Processing Time** | Same (workers parallel) | Same (workers parallel) |
| **Business Logic** | Broken ❌ | Correct ✅ |

**Best of both worlds:** Sequential job execution + Queue-based load leveling + Parallel workers across users!

