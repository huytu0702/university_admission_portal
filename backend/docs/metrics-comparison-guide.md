# Comparing Metrics Before and After Pattern Implementation

This guide explains how to measure and compare the performance metrics of the University Admission Portal before and after applying the design patterns.

## Metrics Overview

The system tracks several key performance indicators (KPIs):
- **P95 Latency**: 95th percentile response time
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Queue Depth**: Average items waiting in queue
- **Cache Hit Rate**: Percentage of cache hits

## How Metrics Are Collected

The system uses a middleware to automatically collect metrics for all endpoints:

1. `MetricsCollectionMiddleware` (`/src/middleware/metrics-collection.middleware.ts`) - Captures response time for all requests
2. `MetricsService` (`/src/metrics/metrics.service.ts`) - Stores and retrieves metrics from the database
3. API endpoints under `/health/metrics/*` - Provide access to collected metrics

## Collecting Baseline Metrics (Before Pattern Implementation)

1. **Disable all feature flags** to run the baseline synchronous version:
   - Queue-Based Load Leveling
   - Competing Consumers
   - Cache-Aside
   - Idempotency Key
   - Retry Exponential Backoff
   - Circuit Breaker Payment
   - Bulkhead Isolation
   - Outbox Pattern
   - CQRS-lite

2. **Run load tests to establish baseline metrics**:
   ```bash
   cd backend/load-tests
   k6 run k6-load-test.js
   ```
   or
   ```bash
   python locust-load-test.py
   ```

3. **Collect metrics during load testing**:
   - Monitor the database metrics table for response times
   - Use the metrics API to fetch values over time periods

4. **Alternatively, use the provided scripts in the metrics-analysis folder**:
   ```bash
   cd backend/metrics-analysis
   node disable-patterns.js
   node baseline-test.js
   ```

## Collecting Improved Metrics (After Pattern Implementation)

1. **Enable key feature flags** to activate the design patterns:
   - Queue-Based Load Leveling
   - Outbox Pattern
   - Cache-Aside (for program catalogs)
   - Competing Consumers
   - Retry with Exponential Backoff
   - Bulkhead Isolation

2. **Run the same load tests** as done for baseline:
   ```bash
   cd backend/load-tests
   k6 run k6-load-test.js
   ```

3. **Collect metrics during load testing with patterns enabled**

4. **Alternatively, use the provided scripts in the metrics-analysis folder**:
   ```bash
   cd backend/metrics-analysis
   node enable-patterns.js
   node improved-test.js
   ```

## Metrics Comparison API Endpoints

The system provides the following API endpoints to access metrics:

### 1. Latency Metrics
```
GET /health/metrics/latency?endpoint=/applications&method=POST&hours=24
```
- `endpoint`: The API endpoint path (e.g., `/applications`)
- `method`: HTTP method (e.g., `POST`, `GET`)
- `hours`: Time range in hours (default: 24)

Response includes:
- Average latency
- Percentile values (50th, 95th, 99th)
- Time period

### 2. Throughput Metrics
```
GET /health/metrics/throughput?endpoint=/applications&method=POST&hours=24
```
- Returns requests per minute for the specified endpoint and method

## Dashboard Access

The admin dashboard allows for visual comparison:

1. Access the admin interface at `/admin`
2. Navigate to the "Metrics" tab
3. View the comparison dashboard showing:
   - P95 Latency comparison
   - Throughput comparison
   - Error rate comparison
   - Queue depth comparison
   - Cache hit rate comparison

## Manual Metrics Comparison

You can also manually query the metrics database:

```sql
-- Compare average latency before and after implementation
SELECT 
    CASE 
        WHEN timestamp < 'IMPLEMENTATION_DATE' THEN 'Before'
        ELSE 'After' 
    END as period,
    AVG(latency) as avg_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency) as p95_latency
FROM metrics
WHERE endpoint = '/applications' AND method = 'POST'
GROUP BY period;

-- Compare throughput (requests per minute)
SELECT 
    CASE 
        WHEN timestamp < 'IMPLEMENTATION_DATE' THEN 'Before'
        ELSE 'After' 
    END as period,
    COUNT(*) / (COUNT(DISTINCT DATE_TRUNC('minute', timestamp)) / 60.0) as requests_per_hour
FROM metrics
WHERE endpoint = '/applications' AND method = 'POST'
GROUP BY period;
```

## Expected Results

After implementing the Queue-Based Load Leveling and Outbox Pattern, you should see:

1. **Improved P95 Latency**: From >1000ms (with 3000 RPS) to <200ms
2. **Increased Throughput**: Better handling of traffic spikes
3. **Reduced Error Rate**: More resilient to temporary failures
4. **Lower Queue Depth**: Smoother processing of requests
5. **Better Cache Hit Rate**: When Cache-Aside pattern is enabled

## Key Performance Targets

- API submit latency: p95 < 200ms (with 202 Accepted) during burst conditions
- Throughput scales linearly with worker count when Competing Consumers are enabled
- Error rate reduction: ≥60% when Retry+DLQ is enabled
- Cache hit rate: ≥90% when Cache-Aside is enabled

## Testing with Different Load Levels

Run tests with different load levels to see the full impact:

1. **Normal load**: 50 RPS
2. **Medium load**: 200 RPS
3. **High load**: 500 RPS
4. **Peak load**: 3000 RPS (simulating deadline conditions)

For each level, compare:
- Average response time
- P95 and P99 response times
- Error rates
- Number of successful requests

## Running the Comparison Process

### Step 1: Prepare the environment
```bash
# Start the full application stack
docker-compose up -d

# Verify the service is running
curl http://localhost:3000/health
```

### Step 2: Get baseline metrics (patterns disabled)
```bash
# Using scripts in the metrics analysis folder
cd backend/metrics-analysis
node disable-patterns.js

# Run load test
k6 run --vus 10 --duration 5m ../load-tests/k6-load-test.js

# Collect metrics
curl "http://localhost:3000/health/metrics/latency?endpoint=/applications&method=POST&hours=1"
curl "http://localhost:3000/health/metrics/throughput?endpoint=/applications&method=POST&hours=1"
```

### Step 3: Enable patterns and test again
```bash
# Using scripts in the metrics analysis folder
cd backend/metrics-analysis
node enable-patterns.js

# Run same load test
k6 run --vus 10 --duration 5m ../load-tests/k6-load-test.js

# Collect metrics after patterns implementation
curl "http://localhost:3000/health/metrics/latency?endpoint=/applications&method=POST&hours=1"
curl "http://localhost:3000/health/metrics/throughput?endpoint=/applications&method=POST&hours=1"
```

### Step 4: Compare results
Compare the collected metrics to see the improvement from implementing the design patterns.

## Using the Metrics Analysis Scripts

The following scripts are available in the `backend/metrics-analysis` folder:

- `disable-patterns.js`: Disables all feature flags for baseline testing
- `enable-patterns.js`: Enables all feature flags for comparison testing
- `baseline-test.js`: Runs load test with patterns disabled
- `improved-test.js`: Runs load test with patterns enabled
- `baseline-metrics.json`: Stores results from baseline test
- `improved-metrics.json`: Stores results from improved test

For a complete list of contents and usage instructions, refer to the README in the metrics-analysis folder.

## Additional Resources

- `m2-pattern.md`: Documentation of Queue-Based Load Leveling and Outbox Pattern implementations
- `metrics-analysis/metrics-comparison-report.md`: Detailed comparison report with analysis