# Performance Optimization cho Design Patterns

## Hiện trạng

Benchmark cho thấy patterns có overhead:
- Latency: +18.56% (258ms → 306ms)
- Throughput: -15.90% (193 → 162 req/s)

**Đây là trade-off hợp lý** giữa performance và reliability.

---

## Optimization Strategies

### 1. Database Optimization ⭐⭐⭐

#### a) Add Indexes
```sql
-- Idempotency checks
CREATE INDEX idx_idempotency_key ON idempotency_store(idempotency_key);
CREATE INDEX idx_idempotency_expires ON idempotency_store(expires_at) WHERE processed = true;

-- Outbox relay
CREATE INDEX idx_outbox_unprocessed ON outbox(created_at) WHERE processed = false;

-- CQRS Read Model
CREATE INDEX idx_app_view_user ON application_view(user_id, created_at DESC);
```

#### b) Connection Pooling
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Tăng connection pool
  connection_limit = 50  // từ 10 lên 50
}
```

**Expected improvement**: -20ms latency

---

### 2. Redis Optimization ⭐⭐⭐

#### a) Connection Pooling
```typescript
// Trong queue config
const redisConfig = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  // Lazy connect
  lazyConnect: true,
  // Connection pool
  maxConnections: 10,
};
```

#### b) Pipeline Commands
```typescript
// Thay vì nhiều commands riêng lẻ
await redis.set(key1, val1);
await redis.set(key2, val2);

// Dùng pipeline
const pipeline = redis.pipeline();
pipeline.set(key1, val1);
pipeline.set(key2, val2);
await pipeline.exec();
```

**Expected improvement**: -10ms latency

---

### 3. Async Processing ⭐⭐⭐

Hiện tại code **chờ** queue job được enqueue:
```typescript
// ❌ Synchronous - chờ queue
await this.queueProducerService.addVerifyDocumentJob(...);
```

Đổi thành fire-and-forget:
```typescript
// ✅ Async - không chờ
this.queueProducerService.addVerifyDocumentJob(...).catch(err => 
  this.logger.error('Queue enqueue failed', err)
);
```

**Expected improvement**: -30ms latency

---

### 4. Optimize Outbox Pattern ⭐⭐

#### a) Batch Inserts
Thay vì insert từng outbox event:
```typescript
// Batch create outbox events
await tx.outbox.createMany({
  data: [
    { eventType: 'document_uploaded', payload: '...' },
    { eventType: 'application_submitted', payload: '...' },
  ]
});
```

#### b) Async Outbox Relay
Tăng tần suất relay từ mỗi 5s → mỗi 1s:
```typescript
// outbox-relay.service.ts
@Cron('*/1 * * * * *')  // Từ */5 → */1
async processOutbox() { ... }
```

**Expected improvement**: -15ms latency

---

### 5. Cache Idempotency Checks ⭐⭐

Thêm Redis cache cho idempotency:
```typescript
async executeWithIdempotency(key: string, fn: Function) {
  // 1. Check Redis cache first
  const cached = await this.redis.get(`idem:${key}`);
  if (cached) return JSON.parse(cached);
  
  // 2. Check database
  const existing = await this.prisma.idempotencyStore.findUnique(...);
  if (existing) {
    // Cache for 1 hour
    await this.redis.setex(`idem:${key}`, 3600, JSON.stringify(existing.result));
    return existing.result;
  }
  
  // 3. Execute
  const result = await fn();
  await this.redis.setex(`idem:${key}`, 3600, JSON.stringify(result));
  return result;
}
```

**Expected improvement**: -25ms latency

---

### 6. Worker Concurrency ⭐

Tăng số workers xử lý jobs:
```typescript
// worker-scaling.service.ts
private readonly workerPools = {
  verify: { min: 2, max: 10, targetConcurrency: 5 },  // Từ 3 lên 5
  payment: { min: 2, max: 8, targetConcurrency: 4 },   // Từ 2 lên 4
  email: { min: 1, max: 5, targetConcurrency: 3 },     // Từ 2 lên 3
};
```

**Expected improvement**: Tốt hơn cho sustained load

---

## Priority Implementation

| Priority | Optimization | Effort | Impact |
|----------|-------------|--------|--------|
| 🔥 P0 | Async Queue Enqueue | Low | -30ms |
| 🔥 P0 | Database Indexes | Low | -20ms |
| ⭐ P1 | Redis Connection Pool | Medium | -10ms |
| ⭐ P1 | Cache Idempotency | Medium | -25ms |
| 📝 P2 | Batch Outbox | Medium | -15ms |
| 📝 P2 | Worker Concurrency | Low | Scalability |

**Tổng expected improvement**: ~100ms latency reduction

---

## Quan trọng: Patterns vs Raw Performance

### Khi nào NÊN dùng patterns?
- Production environment
- Có traffic spike
- Cần reliability cao (financial, important data)
- Multi-service architecture

### Khi nào CÓ THỂ tắt một số patterns?
- Development/testing
- Low traffic
- Non-critical features (analytics, logging)

### Benchmark đúng cách
Thay vì so sánh "ALL ON" vs "ALL OFF", nên test với **real load**:
```powershell
# Test với spike traffic
npm run benchmark:full -- -c 100  # 100 concurrent connections

# Monitor error rate, not just latency
```

Patterns sẽ shine khi có:
- Concurrent requests cao
- Database contention
- External service failures
