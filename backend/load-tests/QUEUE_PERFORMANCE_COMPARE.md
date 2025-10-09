# Queue-Based Load Leveling Performance Comparison

This guide explains how to run performance tests to compare the system's behavior before and after implementing the Queue-Based Load Leveling and Outbox Pattern.

## Overview

This comparison tests the differences between:
- **Baseline (Synchronous)**: Traditional request handling where each request processes all steps synchronously
- **Improved (Queue-Based)**: Asynchronous processing using BullMQ queues and Outbox pattern

## Expected Improvements

When the queue-based patterns are enabled, you should see:

1. **Faster API response times**: `POST /applications` returns 202 Accepted in < 200ms (p95) even under burst load
2. **Better error resilience**: Reduced failure rate during high load periods
3. **Improved scalability**: Ability to handle more requests during traffic spikes
4. **Decoupled processing**: File verification, payment processing, and email sending happen asynchronously

## Prerequisites

1. Ensure the application is running:
   ```bash
   npm run dev
   ```

2. Install k6:
   - Download from https://k6.io/docs/get-started/installation/
   - Or use npm: `npm install -g k6`

## Running the Tests

### Automated Script

Run the automated comparison script:

```bash
# On Windows
run-comparison-tests.bat
```

The script will:
1. Prompt you to ensure feature flags are OFF (baseline mode)
2. Run the baseline test
3. Prompt you to turn feature flags ON (improved mode)
4. Run the improved test
5. Generate comparison results

### Manual Testing

#### 1. Baseline Test (Synchronous Processing)
1. Go to http://localhost:3000/admin
2. Turn OFF the following flags:
   - `queue-based-load-leveling`
   - `outbox-pattern`
3. Run the test:
   ```bash
   FEATURE_MODE=baseline k6 run --out json=baseline-results.json backend/load-tests/compare-queue-performance.js
   ```

#### 2. Improved Test (Queue-Based Processing)
1. Go to http://localhost:3000/admin
2. Turn ON the following flags:
   - `queue-based-load-leveling`
   - `outbox-pattern`
3. Run the test:
   ```bash
   FEATURE_MODE=improved k6 run --out json=improved-results.json backend/load-tests/compare-queue-performance.js
   ```

## Key Metrics to Compare

### Response Times
- **Application submission (p95)**: Should be significantly lower in improved mode
- **Application submission (p99)**: Should be more consistent in improved mode

### Error Rates
- **Overall error rate**: Should be lower in improved mode during high load
- **Timeout errors**: Should be reduced in improved mode

### System Behavior
- **API availability**: Improved mode should maintain availability during load spikes
- **Processing completion**: Both modes should complete processing, but improved mode handles load spikes better

## Understanding the Results

### Baseline Mode Characteristics
- API requests block until all processing is complete
- Under high load, requests may timeout
- Database connections may be exhausted
- Response times increase significantly during traffic spikes

### Improved Mode Characteristics
- API requests return quickly (202 Accepted)
- Processing happens in background workers
- System is more resilient to traffic spikes
- Better separation of concerns between API and processing

## Analyzing Results

After running both tests, compare:

1. **Application submission duration metrics**:
   - In `baseline-results.json`, look for `application_submission_duration`
   - In `improved-results.json`, look for the same metric
   - The improved mode should show significantly better p95/p99 values

2. **Error rates**:
   - Compare the `rate` value for the `errors` metric
   - Improved mode should have lower error rates under load

3. **Throughput**:
   - Compare the number of successful requests per second
   - Improved mode may handle more requests during the same time period

## Troubleshooting

- If tests fail to run, verify that the backend is running on port 3001
- Ensure Redis is running for the queue functionality
- Check that the feature flags are set correctly before each test run
- For accurate results, run tests on a system with adequate resources

## Next Steps

After confirming the performance improvements, consider testing with higher load levels to stress-test both implementations further.