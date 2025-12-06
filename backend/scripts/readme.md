# Reliability Benchmarks - Commands

## Quick Start

```powershell
# 1. Enable patterns
npm run patterns:on

# 2. Test idempotency (prevents duplicates)
npm run benchmark:idempotency

# 3. Test spike load (handles concurrent traffic)
npm run benchmark:spike

# 4. Disable patterns and compare
npm run patterns:off
npm run benchmark:idempotency
npm run benchmark:spike
```

## Customization

```powershell
# Idempotency with more requests
npx ts-node scripts/benchmark-idempotency.ts --requests 100

# Spike with higher load
npx ts-node scripts/benchmark-spike.ts --connections 500 --duration 30
```

## Expected Results

**With Patterns ON:**
- ✅ Idempotency: Only 1 application created (no duplicates)
- ✅ Spike: >95% success rate, low errors

**With Patterns OFF:**
- ❌ Idempotency: N duplicate applications created
- ❌ Spike: <80% success rate, high errors