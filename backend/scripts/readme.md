# Reliability Benchmarks - Commands

## Quick Start

```powershell
# 1. Enable all patterns
npm run patterns:on

# 2. Run all benchmarks
npm run benchmark:spike        # Queue-Based Load Leveling
npm run benchmark:idempotency  # Idempotency Key Pattern
npm run benchmark:cache        # Cache-Aside + CQRS-Lite
npm run benchmark:circuit      # Circuit Breaker
npm run benchmark:workers      # Competing Consumers + Retry

# 3. Disable patterns and compare
npm run patterns:off
npm run benchmark:spike
npm run benchmark:idempotency
```

## Individual Benchmarks

### 1. Spike Load Test (Queue-Based Load Leveling)
Tests how the system handles sudden spikes in concurrent traffic.

```powershell
npx ts-node scripts/benchmark-spike.ts
npx ts-node scripts/benchmark-spike.ts --connections 500 --duration 30
npx ts-node scripts/benchmark-spike.ts -c 1000 -d 60 --queue-timeout 180
```

**Patterns Tested:** `queue-based-load-leveling`, `bulkhead-isolation`, `outbox-pattern`

### 2. Idempotency Test
Tests duplicate request protection using idempotency keys.

```powershell
npx ts-node scripts/benchmark-idempotency.ts
npx ts-node scripts/benchmark-idempotency.ts --requests 100
```

**Patterns Tested:** `idempotency-key`

### 3. Cache Performance Test (Cache-Aside + CQRS)
Tests read performance improvement with caching.

```powershell
npx ts-node scripts/benchmark-cache.ts
npx ts-node scripts/benchmark-cache.ts --requests 100 --warmup 20
```

**Patterns Tested:** `cache-aside`, `cqrs-lite`

### 4. Circuit Breaker Test
Tests failure isolation and fast-fail behavior.

```powershell
npx ts-node scripts/benchmark-circuit-breaker.ts
npx ts-node scripts/benchmark-circuit-breaker.ts --requests 50 --burst 10
```

**Patterns Tested:** `circuit-breaker-payment`, `bulkhead-isolation`

### 5. Worker Resilience Test (Competing Consumers + Retry)
Tests parallel processing and automatic retry behavior.

```powershell
npx ts-node scripts/benchmark-workers.ts
npx ts-node scripts/benchmark-workers.ts --jobs 100 --timeout 180
```

**Patterns Tested:** `competing-consumers`, `retry-exponential-backoff`, `queue-based-load-leveling`

## Pattern Coverage

| Pattern | Benchmark Script |
|---------|-----------------|
| `queue-based-load-leveling` | benchmark-spike.ts, benchmark-workers.ts |
| `idempotency-key` | benchmark-idempotency.ts |
| `outbox-pattern` | benchmark-spike.ts (indirect) |
| `cqrs-lite` | benchmark-cache.ts |
| `circuit-breaker-payment` | benchmark-circuit-breaker.ts |
| `bulkhead-isolation` | benchmark-spike.ts, benchmark-circuit-breaker.ts |
| `competing-consumers` | benchmark-workers.ts |
| `retry-exponential-backoff` | benchmark-workers.ts |
| `cache-aside` | benchmark-cache.ts |

## Expected Results

### With Patterns ON:
- ✅ **Spike Test**: >95% HTTP success rate, queue processing completes
- ✅ **Idempotency**: Only 1 application created from duplicate requests
- ✅ **Cache**: 30%+ latency improvement on warm reads
- ✅ **Circuit Breaker**: Fast-fail when service unhealthy
- ✅ **Workers**: High throughput, automatic retry on failures

### With Patterns OFF:
- ❌ **Spike Test**: Lower success rate under high load
- ❌ **Idempotency**: N duplicate applications created
- ❌ **Cache**: Consistent high latency (no caching)
- ❌ **Circuit Breaker**: Cascading failures possible
- ❌ **Workers**: Sequential processing, no retry

## Results Location

All benchmark results are saved to:
```
backend/benchmark-results/
├── spike-*.json
├── idempotency-*.json
├── cache-*.json
├── circuit-breaker-*.json
└── workers-*.json
```