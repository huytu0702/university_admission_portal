# University Admission Portal

A comprehensive university admission portal demonstrating various architectural design patterns and best practices for building scalable, resilient web applications.

## Overview

This project implements a university admission portal where applicants can register, submit applications with document uploads, process payments, send email and track their application status.

## Key Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Application Management**: Multi-step application submission with file uploads
- **Document Processing**: PDF/JPEG/PNG validation and verification
- **Payment Processing**: Mock payment service with checkout flow
- **Email Notifications**: Automated confirmation emails
- **Status Tracking**: Real-time application progress tracking
- **Responsive UI**: Modern web interface with Tailwind CSS and shadcn/ui

## Technology Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Relational database
- **Prisma ORM** - Database toolkit
- **Redis** - In-memory data structure store
- **JWT** - Authentication and authorization
- **Docker** - Containerization platform

### Frontend
- **Next.js 15** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library
- **TypeScript** - Typed JavaScript

## Kiến Trúc Hiện Đại Với Patterns

Hệ thống hiện tại hoạt động theo mô hình **asynchronous processing**, **event-driven architecture**, với các cơ chế bảo vệ và tối ưu hóa tiên tiến.

## Mermaid Diagram - Luồng Xử Lý Với Patterns

```mermaid
sequenceDiagram
    participant Client as Client (Browser)
    participant Controller as ApplicationsController
    participant Service as ApplicationsService
    participant Idempotency as IdempotencyService
    participant DB as PostgreSQL Database
    participant Outbox as Outbox Table
    participant Scheduler as OutboxRelayScheduler
    participant Queue as Redis Queue (BullMQ)
    participant Workers as Background Workers
    participant CircuitBreaker as Circuit Breaker
    participant ReadModel as CQRS Read Model
    
    Note over Client,ReadModel: Luồng Async Processing với Design Patterns
    
    Client->>Controller: POST /applications<br/>Header: Idempotency-Key
    Controller->>Service: createApplication(userId, dto, key)
    
    rect rgb(200, 255, 200)
    Note right of Service: ✅ Pattern: Idempotency
    Service->>Idempotency: Check idempotency key
    alt Key exists (duplicate request)
        Idempotency-->>Service: Return cached result
        Service-->>Controller: 200 OK (from cache)
        Controller-->>Client: Instant response
    else New request
        Idempotency->>Idempotency: Store key + lock
    end
    end
    
    Note over Service,DB: Transaction với Outbox Pattern
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT application<br/>(status: 'submitted')
    
    loop For each file
        Service->>Service: Validate & write to disk (async)
        Service->>DB: INSERT application_file
    end
    
    rect rgb(200, 255, 200)
    Note right of Service: ✅ Pattern: Outbox
    Service->>Outbox: INSERT outbox event<br/>(document_uploaded)
    Service->>Outbox: INSERT outbox event<br/>(application_submitted)
    end
    
    Service->>DB: COMMIT TRANSACTION
    
    rect rgb(200, 255, 200)
    Note right of Service: ✅ Pattern: CQRS-lite
    Service->>ReadModel: Warm read model cache (async)
    end
    
    Service-->>Controller: {applicationId, statusUrl, payUrl}
    Controller-->>Client: 202 Accepted (< 500ms)
    
    Note over Client,ReadModel: ⚡ Client receives response immediately!
    
    rect rgb(255, 240, 200)
    Note over Scheduler,Queue: Async Processing Pipeline
    
    loop Every 2 seconds
        Scheduler->>Outbox: Fetch unprocessed events
        Outbox-->>Scheduler: Events batch (max 100)
        
        loop For each event
            Scheduler->>Queue: Enqueue job<br/>(verify_document/create_payment/send_email)
            Scheduler->>Outbox: UPDATE processedAt
        end
    end
    end
    
    rect rgb(200, 230, 255)
    Note over Workers: ✅ Pattern: Competing Consumers
    
    par Step 1: Document Verification
        Workers->>Queue: Poll verify_document job
        Queue-->>Workers: Job data
        
        rect rgb(255, 200, 255)
        Note over Workers: ✅ Pattern: Bulkhead Isolation
        Workers->>Workers: Execute in isolated pool<br/>(max concurrency: 5)
        Workers->>Workers: Scan virus (background)
        Workers->>DB: UPDATE application_file
        Workers->>DB: UPDATE application status
        Workers->>Outbox: INSERT event<br/>(document_verified)
        end
        
        alt Job Failed
            rect rgb(255, 200, 200)
            Note over Workers: ✅ Pattern: Retry + Exponential Backoff
            Workers->>Workers: Retry with backoff<br/>(attempts: 3, delay: 2s, 4s, 8s)
            alt Max retries exceeded
                Workers->>Queue: Move to DLQ
            end
            end
        end
    and Step 2: Payment Processing
        Workers->>Queue: Poll create_payment job
        Queue-->>Workers: Job data
        
        rect rgb(255, 200, 255)
        Note over Workers: ✅ Pattern: Circuit Breaker
        Workers->>CircuitBreaker: Check state
        alt Circuit OPEN
            CircuitBreaker-->>Workers: Fast fail
            Workers->>Queue: Retry later
        else Circuit CLOSED/HALF_OPEN
            CircuitBreaker->>CircuitBreaker: Call Stripe API
            alt Success
                CircuitBreaker->>DB: INSERT payment
                CircuitBreaker->>Outbox: INSERT event<br/>(payment_completed)
                CircuitBreaker->>CircuitBreaker: Record success
            else Failure
                CircuitBreaker->>CircuitBreaker: Record failure
                CircuitBreaker->>CircuitBreaker: Open circuit if threshold exceeded
            end
        end
        end
    and Step 3: Email Sending
        Workers->>Queue: Poll send_email job
        Queue-->>Workers: Job data
        Workers->>Workers: Connect SMTP (background)
        Workers->>Workers: Send email
        Workers->>DB: UPDATE application status
        Workers->>Outbox: INSERT event<br/>(email_sent)
    end
    end
    
    Note over Scheduler,Workers: Final Status Update
    Scheduler->>Outbox: Process email_sent event
    Scheduler->>DB: UPDATE application<br/>(status: 'completed', progress: 100)
    Scheduler->>ReadModel: Refresh read model
    
    Note over Client,ReadModel: ✅ Total Background Time: 5-15s<br/>✅ Client Response Time: <500ms<br/>✅ No blocking, full resilience
```

## Các Design Patterns Được Áp Dụng

### 1. Idempotency Pattern

```mermaid
sequenceDiagram
    participant Client1 as Client Request #1
    participant Client2 as Client Request #2 (Duplicate)
    participant Service as ApplicationsService
    participant IdempotencyService as IdempotencyService
    participant DB as Database
    
    Note over Client1,DB: First Request
    Client1->>Service: POST /applications<br/>Idempotency-Key: abc123
    Service->>IdempotencyService: executeWithIdempotency("abc123", fn)
    IdempotencyService->>DB: SELECT * FROM idempotency<br/>WHERE key = 'abc123'
    DB-->>IdempotencyService: NULL (not found)
    
    IdempotencyService->>DB: INSERT INTO idempotency<br/>(key: 'abc123', status: 'processing')
    IdempotencyService->>Service: Execute business logic
    Service->>Service: Create application
    Service-->>IdempotencyService: Result: {applicationId, statusUrl}
    
    IdempotencyService->>DB: UPDATE idempotency<br/>(status: 'completed', response: {...})
    IdempotencyService-->>Client1: 202 Accepted<br/>{applicationId, statusUrl}
    
    Note over Client1,DB: Duplicate Request (network retry)
    Client2->>Service: POST /applications<br/>Idempotency-Key: abc123
    Service->>IdempotencyService: executeWithIdempotency("abc123", fn)
    IdempotencyService->>DB: SELECT * FROM idempotency<br/>WHERE key = 'abc123'
    DB-->>IdempotencyService: Found! status: 'completed'
    
    IdempotencyService-->>Client2: 200 OK (from cache)<br/>{applicationId, statusUrl}
    Note over Client2: ✅ No duplicate application created!
```

**Implementation:**

```typescript
@Injectable()
export class IdempotencyService {
  async executeWithIdempotency<T>(
    key: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!key) {
      // No idempotency key provided, execute directly
      return await fn();
    }

    // Check if this request was already processed
    const existing = await this.prisma.idempotency.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.status === 'completed') {
        // Return cached response
        return JSON.parse(existing.response);
      } else if (existing.status === 'processing') {
        // Request is still processing, wait or poll
        throw new HttpException(
          'Request is still processing',
          HttpStatus.CONFLICT
        );
      }
    }

    // First time seeing this key, create idempotency record
    await this.prisma.idempotency.create({
      data: {
        key,
        status: 'processing',
        createdAt: new Date(),
      },
    });

    try {
      // Execute business logic
      const result = await fn();

      // Store result
      await this.prisma.idempotency.update({
        where: { key },
        data: {
          status: 'completed',
          response: JSON.stringify(result),
          completedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      // Mark as failed
      await this.prisma.idempotency.update({
        where: { key },
        data: {
          status: 'failed',
          response: JSON.stringify({ error: error.message }),
        },
      });
      throw error;
    }
  }
}
```

**Benefits:**
- ✅ Prevents duplicate submissions
- ✅ Safe retries from client
- ✅ Prevents double charging
- ✅ Cached responses for repeated requests

---
### 2. Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> CLOSED: Initial State
    
    CLOSED --> OPEN: Failure threshold exceeded<br/>(5 failures in 60s)
    CLOSED --> CLOSED: Request succeeds
    
    OPEN --> HALF_OPEN: Timeout period elapsed<br/>(30 seconds)
    OPEN --> OPEN: All requests fast-fail
    
    HALF_OPEN --> CLOSED: Test request succeeds
    HALF_OPEN --> OPEN: Test request fails
    HALF_OPEN --> HALF_OPEN: Request succeeds
    
    note right of CLOSED
        Normal operation
        All requests pass through
        Track success/failure rate
    end note
    
    note right of OPEN
        Fast-fail all requests
        Prevent cascading failures
        Wait for recovery period
    end note
    
    note right of HALF_OPEN
        Allow limited requests
        Test if service recovered
        Reset or re-open circuit
    end note
```

**Implementation:**

```typescript
@Injectable()
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitState>();

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getOrCreateCircuit(serviceName);

    // Check circuit state
    if (circuit.state === 'OPEN') {
      // Check if timeout has elapsed
      if (Date.now() - circuit.openedAt! < circuit.timeout) {
        throw new HttpException(
          `Circuit breaker is OPEN for ${serviceName}`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      } else {
        // Transition to HALF_OPEN
        circuit.state = 'HALF_OPEN';
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.recordSuccess(circuit);

      // If in HALF_OPEN, transition to CLOSED
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        circuit.failureCount = 0;
      }

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(circuit);

      // Check if we should open the circuit
      if (circuit.failureCount >= circuit.failureThreshold) {
        circuit.state = 'OPEN';
        circuit.openedAt = Date.now();
      }

      throw error;
    }
  }

  private getOrCreateCircuit(serviceName: string): CircuitState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        failureThreshold: 5,
        timeout: 30000, // 30 seconds
        lastFailureTime: null,
        openedAt: null,
      });
    }
    return this.circuits.get(serviceName)!;
  }
}

// Usage in PaymentService
async createPaymentIntent(applicationId: string) {
  return await this.circuitBreaker.executeWithCircuitBreaker(
    'stripe-api',
    async () => {
      // Call Stripe API
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: 7500,
        currency: 'usd',
        metadata: { applicationId },
      });
      
      return paymentIntent;
    }
  );
}
```

**Circuit States:**

| State | Behavior | Transition |
|-------|----------|------------|
| **CLOSED** | Normal operation, all requests pass through | → OPEN when failure threshold exceeded |
| **OPEN** | Fast-fail all requests, no calls to service | → HALF_OPEN after timeout period |
| **HALF_OPEN** | Allow limited test requests | → CLOSED if success, → OPEN if failure |

**Benefits:**
- ✅ Prevents cascading failures
- ✅ Fast-fail when service is down
- ✅ Automatic recovery detection
- ✅ Protects external services from overload

---

### 3. Bulkhead Isolation Pattern

```mermaid
graph TB
    subgraph "Incoming Requests"
        R1[Request 1]
        R2[Request 2]
        R3[Request 3]
        R4[Request 4]
        R5[Request 5]
        R6[Request 6]
    end
    
    subgraph "Bulkhead: Document Verification Pool"
        BH1_W1[Worker 1]
        BH1_W2[Worker 2]
        BH1_W3[Worker 3]
        BH1_Q[Queue: Max 100]
        BH1_C[Max Concurrency: 3]
    end
    
    subgraph "Bulkhead: Payment Processing Pool"
        BH2_W1[Worker 1]
        BH2_W2[Worker 2]
        BH2_Q[Queue: Max 50]
        BH2_C[Max Concurrency: 2]
    end
    
    subgraph "Bulkhead: Email Sending Pool"
        BH3_W1[Worker 1]
        BH3_W2[Worker 2]
        BH3_W3[Worker 3]
        BH3_W4[Worker 4]
        BH3_Q[Queue: Max 200]
        BH3_C[Max Concurrency: 4]
    end
    
    R1 --> BH1_Q
    R2 --> BH1_Q
    R3 --> BH2_Q
    R4 --> BH2_Q
    R5 --> BH3_Q
    R6 --> BH3_Q
    
    BH1_Q --> BH1_W1
    BH1_Q --> BH1_W2
    BH1_Q --> BH1_W3
    
    BH2_Q --> BH2_W1
    BH2_Q --> BH2_W2
    
    BH3_Q --> BH3_W1
    BH3_Q --> BH3_W2
    BH3_Q --> BH3_W3
    BH3_Q --> BH3_W4
    
    style BH1_W1 fill:#FFB6C1
    style BH1_W2 fill:#FFB6C1
    style BH1_W3 fill:#FFB6C1
    style BH2_W1 fill:#98FB98
    style BH2_W2 fill:#98FB98
    style BH3_W1 fill:#87CEFA
    style BH3_W2 fill:#87CEFA
    style BH3_W3 fill:#87CEFA
    style BH3_W4 fill:#87CEFA
```

**Implementation:**

```typescript
@Injectable()
export class BulkheadService {
  private bulkheads = new Map<string, Bulkhead>();

  constructor() {
    // Configure bulkheads for different services
    this.bulkheads.set('verify_document', {
      maxConcurrent: 3,
      maxQueueSize: 100,
      currentExecuting: 0,
      queue: [],
    });

    this.bulkheads.set('create_payment', {
      maxConcurrent: 2,
      maxQueueSize: 50,
      currentExecuting: 0,
      queue: [],
    });

    this.bulkheads.set('send_email', {
      maxConcurrent: 4,
      maxQueueSize: 200,
      currentExecuting: 0,
      queue: [],
    });
  }

  async executeInBulkhead<T>(
    bulkheadName: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const bulkhead = this.bulkheads.get(bulkheadName);
    
    if (!bulkhead) {
      throw new Error(`Bulkhead ${bulkheadName} not found`);
    }

    // Check if we can execute immediately
    if (bulkhead.currentExecuting < bulkhead.maxConcurrent) {
      bulkhead.currentExecuting++;
      
      try {
        const result = await fn();
        return result;
      } finally {
        bulkhead.currentExecuting--;
        this.processQueue(bulkhead);
      }
    }

    // Queue is full, reject
    if (bulkhead.queue.length >= bulkhead.maxQueueSize) {
      throw new HttpException(
        `Bulkhead ${bulkheadName} queue is full`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    // Add to queue and wait
    return new Promise((resolve, reject) => {
      bulkhead.queue.push({ fn, resolve, reject });
    });
  }

  private async processQueue(bulkhead: Bulkhead) {
    if (
      bulkhead.queue.length > 0 &&
      bulkhead.currentExecuting < bulkhead.maxConcurrent
    ) {
      const task = bulkhead.queue.shift()!;
      bulkhead.currentExecuting++;

      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      } finally {
        bulkhead.currentExecuting--;
        this.processQueue(bulkhead);
      }
    }
  }
}
```

**Benefits:**
- ✅ Resource isolation between services
- ✅ One slow service doesn't affect others
- ✅ Prevents resource starvation
- ✅ Better fault tolerance

---

### 4. Retry with Exponential Backoff + DLQ

```mermaid
sequenceDiagram
    participant Queue as Redis Queue
    participant Worker as Background Worker
    participant Service as External Service
    participant DLQ as Dead Letter Queue
    participant Alert as Alert System
    
    Note over Queue,Alert: Job Processing with Retries
    
    Queue->>Worker: Job #1 (Attempt 1)
    Worker->>Service: Call API
    Service--xWorker: ❌ Timeout Error
    
    Note over Worker: Retry #1 after 2 seconds
    Worker->>Worker: Wait 2s (exponential backoff)
    Worker->>Service: Call API (Attempt 2)
    Service--xWorker: ❌ 500 Internal Server Error
    
    Note over Worker: Retry #2 after 4 seconds
    Worker->>Worker: Wait 4s (2^2 = 4s)
    Worker->>Service: Call API (Attempt 3)
    Service--xWorker: ❌ Connection Refused
    
    Note over Worker: Max retries exceeded!
    Worker->>DLQ: Move job to DLQ
    Worker->>Alert: Send alert notification
    
    Note over DLQ,Alert: Manual investigation required
```

**Implementation:**

```typescript
// Configure retry in queue
await this.paymentQueue.add('create_payment', data, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // initial delay: 2 seconds
  },
  
  // Move to DLQ after max attempts
  removeOnFail: false,
});

// DLQ Service
@Injectable()
export class DlqService {
  async handleFailedJob(job: Job, error: Error) {
    // Log to DLQ
    await this.prisma.deadLetterQueue.create({
      data: {
        jobId: job.id,
        queueName: job.queue.name,
        jobData: JSON.stringify(job.data),
        error: error.message,
        stackTrace: error.stack,
        attempts: job.attemptsMade,
        failedAt: new Date(),
      },
    });

    // Send alert
    await this.alertService.sendAlert({
      type: 'JOB_FAILED',
      severity: 'HIGH',
      message: `Job ${job.id} failed after ${job.attemptsMade} attempts`,
      details: {
        queue: job.queue.name,
        error: error.message,
        jobData: job.data,
      },
    });

    // Update application status
    if (job.data.applicationId) {
      await this.prisma.application.update({
        where: { id: job.data.applicationId },
        data: {
          status: 'failed',
          failureReason: error.message,
        },
      });
    }
  }
}
```


**Benefits:**
- ✅ Handles transient errors automatically
- ✅ Exponential backoff prevents thundering herd
- ✅ DLQ ensures no jobs are lost
- ✅ Alerting for manual intervention

---

### 5. Outbox Pattern

```mermaid
sequenceDiagram
    participant Service as ApplicationsService
    participant DB as PostgreSQL
    participant OutboxTable as Outbox Table
    participant Scheduler as OutboxRelayScheduler (Cron)
    participant Queue as Redis Queue
    
    Note over Service,Queue: Transactional Messaging with Outbox Pattern
    
    Service->>DB: BEGIN TRANSACTION
    Service->>DB: INSERT INTO application
    Service->>DB: INSERT INTO application_file
    
    rect rgb(200, 255, 200)
    Note right of Service: ✅ Same transaction!
    Service->>OutboxTable: INSERT INTO outbox<br/>(eventType: 'document_uploaded')
    Service->>OutboxTable: INSERT INTO outbox<br/>(eventType: 'application_submitted')
    end
    
    Service->>DB: COMMIT TRANSACTION
    Note over Service,DB: ✅ Atomic: both data + events committed together
    
    Service-->>Service: Return to client (fast!)
    
    Note over Scheduler,Queue: Background Relay Process
    
    loop Every 2 seconds
        Scheduler->>OutboxTable: SELECT * FROM outbox<br/>WHERE processedAt IS NULL<br/>LIMIT 100
        OutboxTable-->>Scheduler: Unprocessed events
        
        loop For each event
            alt Event: document_uploaded
                Scheduler->>Queue: Enqueue verify_document job
            else Event: document_verified
                Scheduler->>Queue: Enqueue create_payment job
            else Event: payment_completed
                Scheduler->>Queue: Enqueue send_email job
            else Event: email_sent
                Scheduler->>DB: UPDATE application<br/>(status: 'completed')
            end
            
            Scheduler->>OutboxTable: UPDATE outbox<br/>SET processedAt = NOW()<br/>WHERE id = ?
        end
    end
```

**Implementation:**

```typescript
// Step 1: Create application with outbox events in same transaction
async createApplication(userId: string, dto: CreateApplicationDto) {
  const application = await this.prisma.$transaction(async (tx) => {
    // Create application
    const newApp = await tx.application.create({
      data: { userId, personalStatement: dto.personalStatement, status: 'submitted' },
    });

    // Create files
    for (const file of validatedFiles) {
      await tx.applicationFile.create({
        data: { applicationId: newApp.id, ...file },
      });
    }

    // ✅ Create outbox events in SAME transaction
    await tx.outbox.create({
      data: {
        eventType: 'document_uploaded',
        payload: JSON.stringify({ applicationId: newApp.id, files: [...] }),
      },
    });

    await tx.outbox.create({
      data: {
        eventType: 'application_submitted',
        payload: JSON.stringify({ applicationId: newApp.id }),
      },
    });

    return newApp;
  });

  return { applicationId: application.id, statusUrl: `/applications/${application.id}/status` };
}

// Step 2: Background relay service
@Injectable()
export class OutboxRelayService {
  async processOutbox() {
    const messages = await this.prisma.outbox.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    for (const message of messages) {
      try {
        await this.processMessage(message);
        
        // Mark as processed
        await this.prisma.outbox.update({
          where: { id: message.id },
          data: { processedAt: new Date() },
        });
      } catch (error) {
        this.logger.error(`Failed to process outbox message ${message.id}`, error);
      }
    }
  }

  private async processMessage(message: any) {
    const payload = JSON.parse(message.payload);
    
    switch (message.eventType) {
      case 'document_uploaded':
        await this.queueProducer.addVerifyDocumentJob(`verify_${message.id}`, payload);
        break;
      case 'document_verified':
        await this.queueProducer.addCreatePaymentJob(`payment_${message.id}`, payload);
        break;
      case 'payment_completed':
        await this.queueProducer.addSendEmailJob(`email_${message.id}`, payload);
        break;
      case 'email_sent':
        await this.prisma.application.update({
          where: { id: payload.applicationId },
          data: { status: 'completed', progress: 100 },
        });
        break;
    }
  }
}

// Step 3: Cron scheduler
@Injectable()
export class OutboxRelayScheduler {
  @Cron('*/2 * * * * *') // Every 2 seconds
  async handleCron() {
    await this.outboxRelayService.processOutbox();
  }
}
```

**Benefits:**
- ✅ Guaranteed message delivery (transactional)
- ✅ At-least-once delivery semantics
- ✅ Data consistency between DB and events
- ✅ No message loss even if queue is down

---

### 6. Queue-Based Load Leveling + Competing Consumers

Hệ thống sử dụng **BullMQ (Redis-based queue)** để smooths out traffic spikes và xử lý công việc nền một cách hiệu quả. Competing Consumers pattern cho phép nhiều workers cùng xử lý jobs từ cùng một queue, tăng throughput và khả năng chịu tải.

#### 6.1. Queue Architecture

```mermaid
graph TB
    subgraph "Client Layer - Spiky Traffic"
        C1[👤 Request 1]
        C2[👤 Request 2]
        C3[👤 Request 3]
        C100[👤 Request 100...]
    end
    
    subgraph "API Layer - Fast Response <500ms"
        API[ApplicationsService]
        Producer[QueueProducerService]
    end
    
    subgraph "Queue Layer - BullMQ/Redis Buffer"
        Q1["📋 verify_document<br/>Priority: High (1)<br/>Retry: 3x, Exp backoff 2s"]
        Q2["💳 create_payment<br/>Priority: Highest (0)<br/>Retry: 3x, Exp backoff 2s"]
        Q3["📧 send_email<br/>Priority: Low (2)<br/>Retry: 2x, Exp backoff 1s"]
    end
    
    subgraph "Worker Pool - Competing Consumers"
        subgraph "Doc Verification Pool (Concurrency: 3)"
            DW1[Worker 1]
            DW2[Worker 2]
            DW3[Worker 3]
        end
        
        subgraph "Payment Pool (Concurrency: 5)"
            PW1[Worker 1]
            PW2[Worker 2]
            PW3[Worker 3]
            PW4[Worker 4]
            PW5[Worker 5]
        end
        
        subgraph "Email Pool (Concurrency: 10)"
            EW1[Worker 1-10...]
        end
    end
    
    subgraph "Storage"
        DB[(PostgreSQL)]
        FS[File System]
    end
    
    C1 & C2 & C3 & C100 -->|POST| API
    API -->|Enqueue jobs| Producer
    
    Producer -->|addVerifyDocumentJob| Q1
    Producer -->|addCreatePaymentJob| Q2
    Producer -->|addSendEmailJob| Q3
    
    API -->|202 Accepted| C1
    
    Q1 -.->|Poll & Process| DW1 & DW2 & DW3
    Q2 -.->|Poll & Process| PW1 & PW2 & PW3 & PW4 & PW5
    Q3 -.->|Poll & Process| EW1
    
    DW1 & DW2 & DW3 --> DB
    DW1 & DW2 & DW3 --> FS
    PW1 & PW2 & PW3 & PW4 & PW5 --> DB
    EW1 --> DB
    
    style API fill:#90EE90
    style Producer fill:#98FB98
    style Q1 fill:#FFD700
    style Q2 fill:#FFB347
    style Q3 fill:#FFDAB9
    style DW1 fill:#87CEEB
    style DW2 fill:#87CEEB
    style DW3 fill:#87CEEB
    style PW1 fill:#DDA0DD
    style PW2 fill:#DDA0DD
    style PW3 fill:#DDA0DD
    style PW4 fill:#DDA0DD
    style PW5 fill:#DDA0DD
    style EW1 fill:#F0E68C
```

#### 6.2. Producer - QueueProducerService

Service này chịu trách nhiệm enqueue jobs vào các Redis queues với configuration phù hợp.

```typescript
// backend/src/feature-flags/queue/queue-producer.service.ts

@Injectable()
export class QueueProducerService {
  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
    private bulkheadService: BulkheadService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async addVerifyDocumentJob(
    jobId: string,
    data: any,
    priority: JobPriority = 'normal'
  ): Promise<void> {
    // Check if bulkhead isolation is enabled
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    
    if (flag?.enabled) {
      // Execute with bulkhead isolation
      await this.bulkheadService.executeInBulkhead('verify_document', async () => {
        await this.verifyDocumentQueue.add('verify_document', data, {
          jobId,
          priority: this.mapPriority(priority), // 0=critical, 1=high, 2=normal, 3=low
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s
          },
        });
      });
    } else {
      // Direct enqueue without bulkhead
      await this.verifyDocumentQueue.add('verify_document', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  async addCreatePaymentJob(
    jobId: string,
    data: any,
    priority: JobPriority = 'normal'
  ): Promise<void> {
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    
    if (flag?.enabled) {
      await this.bulkheadService.executeInBulkhead('create_payment', async () => {
        await this.createPaymentQueue.add('create_payment', data, {
          jobId,
          priority: this.mapPriority(priority),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      });
    } else {
      await this.createPaymentQueue.add('create_payment', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  async addSendEmailJob(
    jobId: string,
    data: any,
    priority: JobPriority = 'normal'
  ): Promise<void> {
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    
    if (flag?.enabled) {
      await this.bulkheadService.executeInBulkhead('send_email', async () => {
        await this.sendEmailQueue.add('send_email', data, {
          jobId,
          priority: this.mapPriority(priority),
          attempts: 2, // Email has fewer retries
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });
      });
    } else {
      await this.sendEmailQueue.add('send_email', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  private mapPriority(priority: JobPriority): number {
    switch (priority) {
      case 'low': return 3;
      case 'normal': return 2;
      case 'high': return 1;
      case 'critical': return 0;
      default: return 2;
    }
  }
}
```

**Job Priority Levels:**

| Priority | Numeric Value | Use Case |
|----------|---------------|----------|
| **critical** | 0 | Emergency processing, SLA violations |
| **high** | 1 | Payment processing, time-sensitive tasks |
| **normal** | 2 | Document verification, standard workflows |
| **low** | 3 | Bulk operations, non-urgent tasks |

#### 6.3. Consumer - Worker Implementation

##### 6.3.1. Base Worker Class

```typescript
// backend/src/feature-flags/workers/worker-base.ts

export abstract class WorkerBase {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected prisma: PrismaService) {}

  abstract processJob(jobData: JobData): Promise<any>;

  async processJobWithRetry(jobData: JobData, job: Job): Promise<any> {
    const attemptNumber = job.attemptsMade + 1;
    
    try {
      const result = await this.processJob(jobData);
      this.logger.log(`Job ${job.id} completed successfully on attempt ${attemptNumber}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed on attempt ${attemptNumber} of ${job.opts.attempts || 1}: ${error.message}`,
        error.stack
      );
      
      // Re-throw to trigger BullMQ's retry mechanism
      throw error;
    }
  }

  async updateApplicationStatus(applicationId: string, status: string) {
    let progress = 0;
    
    switch (status) {
      case 'submitted': progress = 25; break;
      case 'verifying': progress = 30; break;
      case 'verified': progress = 50; break;
      case 'verification_failed': progress = 25; break;
      case 'processing_payment': progress = 55; break;
      case 'payment_initiated': progress = 75; break;
      case 'payment_failed': progress = 50; break;
      case 'completed': progress = 100; break;
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status, progress },
    });
  }
}
```

##### 6.3.2. Document Verification Worker

```typescript
// backend/src/feature-flags/workers/document-verification.worker.ts

@Processor('verify_document')
export class DocumentVerificationWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private documentVerificationService: DocumentVerificationService,
  ) {
    super(prisma);
  }

  async processJob(jobData: VerifyDocumentJobData): Promise<any> {
    const { applicationId, applicationFileIds } = jobData;

    // Update status to 'verifying'
    await this.updateApplicationStatus(applicationId, 'verifying');

    try {
      // Verify each document
      for (const filePath of applicationFileIds) {
        const applicationFiles = await this.prisma.applicationFile.findMany({
          where: { applicationId, filePath },
        });

        for (const file of applicationFiles) {
          await this.documentVerificationService.verifyDocument(file.id);
        }
      }

      // Update status to 'verified'
      await this.updateApplicationStatus(applicationId, 'verified');

      // Emit event to trigger next workflow step (payment)
      await this.prisma.outbox.create({
        data: {
          eventType: 'document_verified',
          payload: JSON.stringify({ applicationId }),
        },
      });
      this.logger.log(`Emitted document_verified event for app: ${applicationId}`);

      return { success: true, applicationId };
    } catch (error) {
      await this.updateApplicationStatus(applicationId, 'verification_failed');
      this.logger.error(`Document verification failed for ${applicationId}: ${error.message}`);
      throw error;
    }
  }

  @Process('verify_document')
  async processVerifyDocument(job: Job<VerifyDocumentJobData>): Promise<any> {
    return await this.processJobWithRetry(job.data, job);
  }
}
```

##### 6.3.3. Payment Processing Worker

```typescript
// backend/src/feature-flags/workers/payment-processing.worker.ts

@Processor('create_payment')
export class PaymentProcessingWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private paymentService: PaymentService,
  ) {
    super(prisma);
  }

  async processJob(jobData: CreatePaymentJobData): Promise<any> {
    const { applicationId } = jobData;

    await this.updateApplicationStatus(applicationId, 'processing_payment');

    try {
      // Create payment intent
      await this.paymentService.createPaymentIntent({
        applicationId,
        amount: 7500, // $75.00 application fee
        currency: 'usd',
      });

      await this.updateApplicationStatus(applicationId, 'payment_initiated');

      // Emit event to trigger next workflow step (email)
      await this.prisma.outbox.create({
        data: {
          eventType: 'payment_completed',
          payload: JSON.stringify({ applicationId }),
        },
      });
      this.logger.log(`Emitted payment_completed event for app: ${applicationId}`);

      return { success: true, applicationId };
    } catch (error) {
      await this.updateApplicationStatus(applicationId, 'payment_failed');
      this.logger.error(`Payment processing failed for ${applicationId}: ${error.message}`);
      throw error;
    }
  }

  @Process('create_payment')
  async processCreatePayment(job: Job<CreatePaymentJobData>): Promise<any> {
    return this.processJobWithRetry(job.data, job);
  }
}
```

##### 6.3.4. Email Sending Worker

```typescript
// backend/src/feature-flags/workers/email-sending.worker.ts

@Processor('send_email')
export class EmailSendingWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private emailService: EmailService,
  ) {
    super(prisma);
  }

  async processJob(jobData: SendEmailJobData): Promise<any> {
    const { applicationId, email, template = 'status-update' } = jobData;

    try {
      // Send email based on template
      if (template === 'status-update') {
        const application = await this.prisma.application.findUnique({
          where: { id: applicationId },
          include: { user: true }
        });

        if (application?.user.email) {
          await this.emailService.sendApplicationStatusUpdate(
            application.user.email,
            applicationId,
            application.status as any
          );
        }
      } else if (template === 'confirmation') {
        await this.emailService.sendApplicationConfirmation(email, applicationId);
      }

      await this.updateApplicationStatus(applicationId, 'email_sent');

      // Emit event to mark workflow as complete
      await this.prisma.outbox.create({
        data: {
          eventType: 'email_sent',
          payload: JSON.stringify({ applicationId }),
        },
      });
      this.logger.log(`Emitted email_sent event for app: ${applicationId}`);

      return { success: true, applicationId, email };
    } catch (error) {
      await this.updateApplicationStatus(applicationId, 'email_failed');
      this.logger.error(`Email sending failed for ${applicationId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('send_email')
  async processSendEmail(job: Job<SendEmailJobData>): Promise<any> {
    return this.processJobWithRetry(job.data, job);
  }
}
```

#### 6.4. Competing Consumers Pattern

```mermaid
sequenceDiagram
    participant Q as Redis Queue (verify_document)
    participant W1 as Worker 1
    participant W2 as Worker 2
    participant W3 as Worker 3
    participant DB as PostgreSQL
    
    Note over Q: 100 jobs waiting in queue
    
    par Worker 1 processing
        Q->>W1: Poll job #1
        W1->>W1: Process job #1
        W1->>DB: Update status
        W1->>Q: ACK job #1
        Q->>W1: Poll job #4
        W1->>W1: Process job #4
        W1->>DB: Update status
        W1->>Q: ACK job #4
    and Worker 2 processing
        Q->>W2: Poll job #2
        W2->>W2: Process job #2
        W2->>DB: Update status
        W2->>Q: ACK job #2
        Q->>W2: Poll job #5
        W2->>W2: Process job #5
        W2->>DB: Update status
        W2->>Q: ACK job #5
    and Worker 3 processing
        Q->>W3: Poll job #3
        W3->>W3: Process job #3
        W3->>DB: Update status
        W3->>Q: ACK job #3
        Q->>W3: Poll job #6
        W3->>W3: Process job #6
        W3->>DB: Update status
        W3->>Q: ACK job #6
    end
    
    Note over Q,DB: ✅ 3 workers process 6 jobs in parallel<br/>Throughput: 3x faster than single worker
```

#### 6.5. Worker Pool Management

```typescript
// backend/src/feature-flags/workers/worker-pool.service.ts

@Injectable()
export class WorkerPoolService implements OnModuleInit {
  private readonly logger = new Logger(WorkerPoolService.name);
  private pools: Map<string, WorkerPoolDefinition> = new Map();
  private poolStats: Map<string, WorkerPoolStats> = new Map();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async onModuleInit() {
    const flag = await this.featureFlagsService.getFlag('competing-consumers');
    
    if (flag?.enabled) {
      this.initializePools();
      this.startHealthMonitoring();
    }
  }

  private initializePools() {
    // Document Verification Pool
    this.registerPool({
      poolId: 'pool_verify_document',
      poolName: 'Document Verification',
      queueName: 'verify_document',
      description: 'Processes document verification tasks',
      concurrency: 3,
      priority: 1, // High priority
      enabled: true,
    });

    // Payment Processing Pool
    this.registerPool({
      poolId: 'pool_create_payment',
      poolName: 'Payment Processing',
      queueName: 'create_payment',
      description: 'Handles payment creation and processing',
      concurrency: 5,
      priority: 0, // Highest priority
      enabled: true,
    });

    // Email Sending Pool
    this.registerPool({
      poolId: 'pool_send_email',
      poolName: 'Email Notifications',
      queueName: 'send_email',
      description: 'Sends email notifications',
      concurrency: 10,
      priority: 2, // Lower priority
      enabled: true,
    });
  }

  async getPoolStats(poolId: string): Promise<WorkerPoolStats> {
    const definition = this.pools.get(poolId);
    const queue = this.getQueue(definition.queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Calculate throughput (jobs completed in last minute)
    const recentJobs = await queue.getCompleted(0, 99);
    const oneMinuteAgo = Date.now() - 60000;
    const throughput = recentJobs.filter(
      job => job.finishedOn && job.finishedOn > oneMinuteAgo
    ).length;

    return {
      poolId,
      poolName: definition.poolName,
      queueName: definition.queueName,
      enabled: definition.enabled,
      concurrency: definition.concurrency,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: await queue.isPaused(),
      throughput,
      avgProcessingTime: 0, // Calculated from job metrics
      errorRate: 0,
      lastJobCompletedAt: null,
      lastJobFailedAt: null,
    };
  }
}
```

**Worker Pool Configuration:**

| Pool Name | Queue | Concurrency | Priority | Use Case |
|-----------|-------|-------------|----------|----------|
| **Payment Processing** | `create_payment` | 5 | 0 (Highest) | Critical payment workflows |
| **Document Verification** | `verify_document` | 3 | 1 (High) | Security-sensitive document scanning |
| **Email Notifications** | `send_email` | 10 | 2 (Normal) | Non-critical notifications |

#### 6.6. Dynamic Worker Scaling

```typescript
// backend/src/feature-flags/workers/worker-scaling.service.ts

@Injectable()
export class WorkerScalingService implements OnModuleInit {
  private readonly logger = new Logger(WorkerScalingService.name);
  private scalingConfigs: Map<string, WorkerScalingConfig> = new Map();
  private currentWorkerCounts: Map<string, number> = new Map();

  private initializeConfigs() {
    // Document Verification: Scale 2-10 workers
    this.scalingConfigs.set('verify_document', {
      queueName: 'verify_document',
      minWorkers: 2,
      maxWorkers: 10,
      scaleUpThreshold: 50,   // Scale up when >50 jobs waiting
      scaleDownThreshold: 10, // Scale down when <10 jobs waiting
      checkInterval: 10000,   // Check every 10 seconds
      cooldownPeriod: 30000,  // Wait 30s between scaling actions
    });

    // Payment Processing: Scale 3-15 workers
    this.scalingConfigs.set('create_payment', {
      queueName: 'create_payment',
      minWorkers: 3,
      maxWorkers: 15,
      scaleUpThreshold: 30,
      scaleDownThreshold: 5,
      checkInterval: 10000,
      cooldownPeriod: 20000, // Faster scaling for critical payments
    });

    // Email Sending: Scale 2-8 workers
    this.scalingConfigs.set('send_email', {
      queueName: 'send_email',
      minWorkers: 2,
      maxWorkers: 8,
      scaleUpThreshold: 100, // Emails can queue more
      scaleDownThreshold: 20,
      checkInterval: 15000,
      cooldownPeriod: 30000,
    });
  }

  private async evaluateScaling() {
    for (const [queueName, config] of this.scalingConfigs.entries()) {
      const queue = this.getQueue(queueName);
      const waitingCount = await queue.getWaitingCount();
      const currentWorkers = this.currentWorkerCounts.get(queueName) || config.minWorkers;

      // Check cooldown period
      const lastScaling = this.lastScalingTimes.get(queueName) || 0;
      if (Date.now() - lastScaling < config.cooldownPeriod) {
        continue; // Still in cooldown
      }

      // Scale up logic
      if (waitingCount >= config.scaleUpThreshold && currentWorkers < config.maxWorkers) {
        const newWorkerCount = Math.min(currentWorkers + 1, config.maxWorkers);
        this.scaleWorkers(queueName, newWorkerCount);
        this.logger.log(
          `Scaled UP '${queueName}': ${currentWorkers} → ${newWorkerCount} workers ` +
          `(waiting: ${waitingCount}, threshold: ${config.scaleUpThreshold})`
        );
      }
      // Scale down logic (only if no active jobs)
      else if (waitingCount <= config.scaleDownThreshold && currentWorkers > config.minWorkers) {
        const activeCount = await queue.getActiveCount();
        if (activeCount === 0) {
          const newWorkerCount = Math.max(currentWorkers - 1, config.minWorkers);
          this.scaleWorkers(queueName, newWorkerCount);
          this.logger.log(
            `Scaled DOWN '${queueName}': ${currentWorkers} → ${newWorkerCount} workers ` +
            `(waiting: ${waitingCount}, threshold: ${config.scaleDownThreshold})`
          );
        }
      }
    }
  }
}
```

**Auto-Scaling Diagram:**

```mermaid
graph LR
    subgraph "Traffic Pattern"
        T1[Normal Load<br/>20 jobs/min]
        T2[Spike!<br/>200 jobs/min]
        T3[Peak<br/>500 jobs/min]
        T4[Normal<br/>20 jobs/min]
    end
    
    subgraph "Worker Scaling"
        W1[2 workers<br/>Min capacity]
        W2[5 workers<br/>Scaled up]
        W3[10 workers<br/>Max capacity]
        W4[2 workers<br/>Scaled down]
    end
    
    subgraph "Queue Depth"
        Q1[5 jobs waiting]
        Q2[60 jobs waiting<br/>⚠️ Threshold: 50]
        Q3[150 jobs waiting<br/>⚠️ Threshold: 50]
        Q4[8 jobs waiting]
    end
    
    T1 --> Q1 --> W1
    T2 --> Q2 --> W2
    T3 --> Q3 --> W3
    T4 --> Q4 --> W4
    
    style T2 fill:#FFB347
    style T3 fill:#FF6347
    style Q2 fill:#FFD700
    style Q3 fill:#FFA500
    style W2 fill:#90EE90
    style W3 fill:#32CD32
```

#### 6.7. Benefits

**Queue-Based Load Leveling:**
- ✅ **Smooths traffic spikes**: 500 req/s spike → steady 50 req/s processing
- ✅ **Prevents database overload**: Queue acts as buffer, protects DB from connection pool exhaustion
- ✅ **Graceful degradation**: System remains responsive even under extreme load
- ✅ **Job prioritization**: Critical payments processed before non-urgent emails

**Competing Consumers:**
- ✅ **Parallel processing**: 3-10 workers process jobs concurrently
- ✅ **Horizontal scalability**: Add more worker instances without code changes
- ✅ **Fault isolation**: Worker crash doesn't affect others, job automatically retried
- ✅ **Load distribution**: BullMQ distributes jobs evenly across available workers

**Auto-Scaling:**
- ✅ **Dynamic capacity**: Automatically scale 2→10 workers based on queue depth
- ✅ **Cost optimization**: Scale down to minimum during off-peak hours
- ✅ **Self-healing**: Detect and respond to traffic patterns without manual intervention
- ✅ **Cooldown protection**: Prevent thrashing with 20-30s cooldown periods

---

### 7. Cache-Aside & CQRS-lite Pattern

Hai patterns này tối ưu hóa **read operations** bằng cách giảm database load và tăng tốc độ response, đồng thời tách biệt read model và write model để scale độc lập.

---

#### 7.1. Vấn Đề

**Trước khi áp dụng patterns:**

```mermaid
sequenceDiagram
    participant Client
    participant API as ApplicationsController
    participant DB as PostgreSQL
    
    Note over Client,DB: Mọi read request đều hit database
    
    loop Multiple concurrent requests
        Client->>API: GET /applications/:id
        API->>DB: SELECT * FROM "Application"<br/>JOIN application_files<br/>JOIN payment
        DB-->>API: Complex query with JOINs
        API-->>Client: Response
    end
    
    Note over DB: ❌ Database overload<br/>❌ High latency<br/>❌ No caching
```

**Vấn đề:**
- ❌ **High latency**: Mọi read query hit database trực tiếp
- ❌ **Database overload**: Read queries chiếm tài nguyên DB
- ❌ **Poor scalability**: Database là bottleneck cho read-heavy workload
- ❌ **No separation**: Read và write dùng chung table với JOINs phức tạp

---

#### 7.2. Cache-Aside Pattern

Cache-Aside (Lazy Loading) pattern đặt một **cache layer** (Redis) giữa application và database.

```mermaid
sequenceDiagram
    participant Client
    participant API as ApplicationReadService
    participant Cache as Redis Cache
    participant View as application_view
    participant DB as Application Table
    
    Note over Client,DB: Cache-Aside Flow với CQRS Fallback
    
    Client->>API: GET /read/applications/:id
    
    rect rgb(255, 240, 200)
    Note over API,Cache: Step 1: Check Cache
    API->>Cache: GET application:123
    
    alt Cache Hit
        Cache-->>API: ✅ Data found
        API-->>Client: Return cached data
        Note over Client: ✅ Fast response
    else Cache Miss
        Cache-->>API: ❌ Not found
    end
    end
    
    rect rgb(200, 255, 200)
    Note over API,DB: Step 2: Query Database (CQRS-lite)
    API->>View: SELECT * FROM application_view
    
    alt View Available
        View-->>API: ✅ Data from VIEW
    else View Not Found
        API->>DB: SELECT * FROM "Application"
        DB-->>API: ✅ Data from table
    end
    end
    
    rect rgb(200, 230, 255)
    Note over API,Cache: Step 3: Populate Cache
    API->>Cache: SET application:123<br/>TTL: configurable
    API-->>Client: Return data
    Note over Client: ⚠️ First request slower<br/>✅ Next requests fast
    end
```

**Flow:**
1. **Check cache first**: Application kiểm tra Redis trước
2. **Cache hit**: Return ngay lập tức từ cache - không hit database
3. **Cache miss**: Query database (VIEW → table fallback) → populate cache → return
4. **Next request**: Serve từ cache (fast)

**Implementation:**

```typescript
@Injectable()
export class ApplicationReadService {
  async getById(applicationId: string): Promise<ApplicationView> {
    const [useCache, useView] = await this.getFlags();
    const cacheKey = this.getApplicationKey(applicationId);
    
    // Step 1: Try cache first (if enabled)
    if (useCache) {
      const cached = await this.cache.get<ApplicationView>(cacheKey);
      if (cached) return cached; // ✅ Cache hit
    }

    // Step 2: Cache miss → Query DB (VIEW or table)
    const data = await this.viewService.getView(applicationId, useView);
    if (!data) throw new NotFoundException();

    // Step 3: Populate cache for next request
    if (useCache) {
      await this.cache.set(cacheKey, data, APPLICATION_CACHE_TTL);
    }
    
    return data;
  }
}
```

**Cache Keys Strategy:**

| Key Pattern | Example | Purpose |
|-------------|---------|---------|
| `application:{id}` | `application:app-123` | Single application cache |
| `application:list:{userId}` | `application:list:user-456` | User's list cache |

**Cache Configuration:**
- **TTL**: Configurable via `APPLICATION_CACHE_TTL_SECONDS` env (default: 60s)
- **Eviction**: TTL-based expiration + manual invalidation
- **Graceful degradation**: Nếu Redis down → fallback to database

---

#### 7.3. CQRS-lite Pattern

CQRS-lite tách biệt **read model** và **write model** để tối ưu riêng cho từng use case.

```mermaid
graph TB
    subgraph "Write Model (Command)"
        Write[Write Operations<br/>POST /applications]
        WriteDB[("Application" table<br/>Normalized, có JOIN)]
    end
    
    subgraph "Read Model (Query)"
        Read[Read Operations<br/>GET /read/applications]
        ReadView[("application_view"<br/>Denormalized, no JOIN)]
    end
    
    subgraph "Sync Mechanism"
        ViewSync["CREATE OR REPLACE VIEW<br/>(auto-sync)"]
    end
    
    Write --> WriteDB
    WriteDB --> ViewSync
    ViewSync --> ReadView
    Read --> ReadView
    ReadView -.->|Fallback| WriteDB
    
    style WriteDB fill:#FFB6C1
    style ReadView fill:#90EE90
    style ViewSync fill:#FFD700
```

**Read Model:** `application_view` (PostgreSQL VIEW)

```sql
CREATE OR REPLACE VIEW application_view AS
SELECT 
  id,
  "userId",
  status,
  progress,
  "createdAt",
  "updatedAt"
FROM "Application";

-- Index trên bảng gốc (không thể tạo index trên VIEW)
CREATE INDEX IF NOT EXISTS "Application_userId_idx" ON "Application"("userId");
CREATE INDEX IF NOT EXISTS "Application_updatedAt_idx" ON "Application"("updatedAt" DESC);
```

**Đặc điểm:**
- ✅ **Denormalized**: Không có JOIN → query nhanh hơn
- ✅ **Auto-sync**: VIEW tự động reflect changes từ `Application` table
- ✅ **Read-optimized**: Chỉ select các fields cần thiết cho read operations
- ✅ **No Prisma model**: Query bằng `$queryRaw` (VIEW không có Prisma model)

**Fallback Strategy:**

```typescript
async getView(applicationId: string, useView = true): Promise<ApplicationView | null> {
  if (useView) {
    // Try application_view first
    const fromView = await this.getFromView(applicationId);
    if (fromView) return fromView; // ✅ Fast path
  }
  
  // Fallback to Application table
  return this.getFromSource(applicationId);
}

private async getFromView(applicationId: string): Promise<ApplicationView | null> {
  try {
    const rows = await this.prisma.$queryRaw<ApplicationView[]>`
      SELECT id, "userId", status, progress, "createdAt", "updatedAt"
      FROM application_view
      WHERE id = ${applicationId}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (err) {
    // ✅ Graceful: VIEW might not exist during migration
    this.logger.debug(`application_view not available, falling back`);
    return null;
  }
}

private async getFromSource(applicationId: string): Promise<ApplicationView | null> {
  return this.prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true, progress: true, createdAt: true, updatedAt: true }
  });
}
```

---

#### 7.4. Cache Invalidation Strategy

**Vấn đề:** Khi data trong database thay đổi, cache cũ trở nên stale (lỗi thời).

**Giải pháp:** Invalidate (xóa) cache khi data thay đổi.

```mermaid
sequenceDiagram
    participant Worker as Background Worker
    participant Service as ApplicationsService
    participant ReadService as ApplicationReadService
    participant Cache as Redis
    participant DB as PostgreSQL
    
    Note over Worker,DB: Cache Invalidation Flow
    
    Worker->>Service: Job completed (status changed)
    Service->>DB: UPDATE "Application"<br/>SET status = 'verified'
    
    Service->>ReadService: refresh(applicationId)
    
    rect rgb(255, 240, 200)
    Note over ReadService,DB: Fetch Latest Data
    ReadService->>DB: Query application_view
    DB-->>ReadService: Latest data
    end
    
    rect rgb(200, 255, 200)
    Note over ReadService,Cache: Update & Invalidate Cache
    ReadService->>Cache: SET application:123 (update single)
    ReadService->>Cache: DEL application:list:user-456 (cascade)
    end
    
    Note over ReadService: ✅ Next read: fresh data
```

**Implementation:**

```typescript
async refresh(applicationId: string): Promise<ApplicationView> {
  const [useCache, useView] = await this.getFlags();
  
  // Fetch latest data from DB
  const data = await this.viewService.getView(applicationId, useView);
  if (!data) {
    throw new NotFoundException(`Application ${applicationId} not found`);
  }
  
  if (useCache) {
    // Update single item cache
    await this.cache.set(this.getApplicationKey(applicationId), data, APPLICATION_CACHE_TTL);
    
    // ✅ Cascade invalidation: Delete list cache
    // (vì list chứa item này với data cũ)
    await this.cache.del(this.getUserListKey(data.userId));
  }
  
  return data;
}

async evict(applicationId: string): Promise<void> {
  const [useCache] = await this.getFlags();
  if (!useCache) return;

  const cached = await this.cache.get<ApplicationView>(this.getApplicationKey(applicationId));
  if (cached) {
    await this.cache.del(this.getApplicationKey(applicationId));
    await this.cache.del(this.getUserListKey(cached.userId));
  } else {
    await this.cache.del(this.getApplicationKey(applicationId));
  }
}
```

**Invalidation Triggers:**

| Trigger | Khi nào | Method |
|---------|---------|--------|
| **Worker completes** | Background job xong | `refresh()` |
| **Manual refresh** | Admin force refresh | `POST /read/applications/:id/refresh` |
| **TTL expires** | Sau TTL seconds | Auto by Redis |

**Cascade Invalidation:**

Khi application `app-123` của user `user-456` thay đổi:
- Invalidate: `application:app-123` (single item)
- Invalidate: `application:list:user-456` (list chứa item này)

Tại sao cascade? Vì list cache chứa application với data cũ, phải xóa để lần query sau fetch data mới.


---

#### 7.5. Benefits

**Cache-Aside Pattern:**
- ✅ **Significantly faster reads**: Cache hits avoid database queries
- ✅ **Reduced DB load**: Majority of queries served from cache
- ✅ **Graceful degradation**: System works even if Redis fails
- ✅ **TTL-based expiration**: Auto cleanup stale data
- ✅ **Feature flag controlled**: Can enable/disable via `cache-aside` flag
- ✅ **Horizontal scalability**: Redis can scale independently

**CQRS-lite Pattern:**
- ✅ **Read/write separation**: Optimize independently for each use case
- ✅ **Denormalized read model**: No JOINs → simpler queries
- ✅ **Auto-sync VIEW**: Automatically reflects changes from write model
- ✅ **Fallback strategy**: Works during migrations when VIEW not available
- ✅ **No Prisma model needed**: Query with `$queryRaw` for flexibility
- ✅ **Feature flag controlled**: Can enable/disable via `cqrs-lite` flag

**Combined Benefits:**
- ✅ **3-tier fallback**: Redis → application_view → Application
- ✅ **High availability**: Multiple fallback levels ensure uptime
- ✅ **Improved scalability**: Cache and read model reduce DB bottleneck
- ✅ **Flexible deployment**: Can enable/disable patterns via feature flag
---

## Comparison: Before vs After

Báo cáo dưới đây tổng hợp kết quả Benchmark Testing cho hệ thống University Admission Portal, so sánh hiệu năng và độ ổn định giữa hai trạng thái: **Patterns OFF** (Tắt Design Patterns) và **Patterns ON** (Bật Design Patterns).

---

### Tổng quan

Hệ thống benchmark bao gồm 5 file test chính, mỗi file test một hoặc nhiều design patterns:

| File | Mục đích | Patterns được test |
|------|----------|-------------------|
| `benchmark-spike.ts` | Test khả năng chịu tải đột biến | Queue-Based Load Leveling, Bulkhead, Outbox |
| `benchmark-idempotency.ts` | Test ngăn chặn duplicate requests | Idempotency Key |
| `benchmark-cache.ts` | Test hiệu suất đọc với cache | Cache-Aside, CQRS-Lite |
| `benchmark-circuit-breaker.ts` | Test isolation khi có lỗi | Circuit Breaker |
| `benchmark-workers.ts` | Test xử lý song song và retry | Competing Consumers, Retry Backoff |


### 1. Spike Load Test (benchmark-spike.ts)

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

### 2. Idempotency Test (benchmark-idempotency.ts)

**Mô tả Test:**
Gửi 50 requests liên tiếp có cùng `Idempotency-Key` để kiểm tra khả năng chống duplicate.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Applications Created** | 50 (Duplicates) | **1 (Unique)** | ✅ Ngăn chặn hoàn toàn trùng lặp dữ liệu. |
| **Response** | 50 x 201 Created | 1 x 201, 49 x 409/200 | ✅ Đảm bảo tính nhất quán (Data Consistency). |

> **Nhận xét:** Design pattern Idempotency Key hoạt động chính xác, đảm bảo 1 request chỉ được xử lý 1 lần duy nhất dù client có retry nhiều lần.

---

### 3. Cache Performance Test (benchmark-cache.ts)

**Mô tả Test:**
Đo lường độ trễ (latency) khi đọc dữ liệu hồ sơ. So sánh giữa đọc trực tiếp Database và đọc qua Redis Cache.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Avg Latency (Warm)** | 9.56 ms | **8.64 ms** | ✅ Cải thiện ~13.6% tốc độ đọc. |
| **Hit Strategy** | Direct DB Hit | Redis Cache Hit | ✅ Giảm tải cho Database cho các truy vấn lặp lại. |

> **Nhận xét:** Mặc dù Database local phản hồi rất nhanh (9ms), việc sử dụng Cache vẫn giúp giảm thêm latency và quan trọng hơn là giảm load trực tiếp lên Database.

---

### 4. Circuit Breaker Test (benchmark-circuit-breaker.ts)

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

### 5. Worker Resilience Test (benchmark-workers.ts)

**Mô tả Test:**
Đo lường khả năng xử lý job của hệ thống worker, bao gồm khả năng scale và retry.

**Kết quả So sánh:**

| Metric | Patterns OFF | Patterns ON | Đánh giá |
|--------|-------------|-------------|----------|
| **Execution Mode** | Synchronous | Parallel Workers | ✅ Tận dụng đa luồng/đa servers. |
| **Throughput** | ~5.5 jobs/sec | ~6.7 jobs/sec | ✅ Xử lý song song cho hiệu năng cao hơn. |
| **Scalability** | Fixed (1 thread) | Auto-scale (3-8 workers) | ✅ Worker pool tự động scale theo tải. |

> **Ghi chú:**
> *   **Job:** Là một tác vụ nền cụ thể (ví dụ: `verify_document`, `create_payment`, `send_email`). Một hồ sơ nộp vào sẽ sinh ra 3 jobs này.
> *   Kết quả thực tế cho thấy xử lý bất đồng bộ (Async) nhanh hơn ~20% so với đồng bộ (Sync) ngay cả ở tải thấp. Khả năng scale sẽ càng rõ rệt hơn khi backlog lớn.

---

## Tổng kết chung

Việc áp dụng bộ Design Patterns đã mang lại hiệu quả rõ rệt:

1.  **Độ ổn định (Availability):** Tăng từ ~52% lên **100%** dưới tải cao.
2.  **Trải nghiệm người dùng:** Giảm thời gian chờ đợi phản hồi (Latency cho write request giảm từ việc chờ process sang chờ ack).
3.  **Toàn vẹn dữ liệu:** Ngăn chặn hoàn toàn việc tạo duplicate data.
4.  **Khả năng mở rộng:** Hệ thống tự động scale workers để xử lý backlog lớn mà không làm gián đoạn API.