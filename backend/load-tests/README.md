# Load Testing

This directory contains load test scripts for the University Admission Portal API using both k6 and Locust.

## Prerequisites

### For k6 Tests
- Install k6: `npm install -g k6` or download from [k6.io](https://k6.io/)
- The API server must be running locally or accessible at the specified BASE_URL

### For Locust Tests
- Install Locust: `pip install locust`
- The API server must be running locally or accessible

## Running k6 Tests

### Basic Load Test
```bash
# Run the basic k6 load test
k6 run k6-load-test.js

# Run with custom base URL
k6 run -e BASE_URL=http://your-api-url.com k6-load-test.js

# Run with summary output to file
k6 run --summary-export=results.json k6-load-test.js
```

### Comprehensive Load Test
```bash
# Run the comprehensive k6 load test
k6 run comprehensive-k6-test.js

# Run with custom base URL
k6 run -e BASE_URL=http://your-api-url.com comprehensive-k6-test.js
```

## Running Locust Tests

```bash
# Run Locust with default settings (localhost:8089)
locust -f locust-load-test.py

# Run Locust with custom host
locust -f locust-load-test.py --host http://your-api-url.com

# Run Locust with specific number of users and spawn rate
locust -f locust-load-test.py --users 100 --spawn-rate 10

# Run Locust headless (no web UI)
locust -f locust-load-test.py --headless --users 50 --spawn-rate 5 --run-time 5m
```

## Test Scenarios

### k6 Tests
1. **Smoke Test**: Lightweight test with 10 VUs for 1 minute
2. **Stress Test**: Gradually increases load from 0 to 100 VUs over 3.5 minutes
3. **Soak Test**: Runs extended test with consistent load

### Locust Tests
1. **User Journey Simulation**: 
   - Register new user
   - Login with credentials
   - Submit application
   - Initiate payment
2. **Weighted Task Distribution**: Different tasks have different likelihoods of execution

## Metrics Collected

### k6 Metrics
- Request duration (p50, p95, p99)
- Error rates
- Throughput (RPS)
- Custom business metrics (registrations, applications, payments)

### Locust Metrics
- Response times
- Requests per second
- Failure rates
- Concurrent users

## Thresholds and SLAs

Both test suites enforce the following performance thresholds:
- 95th percentile response time < 500ms
- Error rate < 1%
- 99th percentile response time < 1000ms
- Check success rate > 99%

## Analyzing Results

### k6 Results
Results are displayed in the terminal and can be exported to JSON for further analysis.

### Locust Results
Results are available through the web UI at `http://localhost:8089` or in the terminal when running headless.

## Customizing Tests

### Environment Variables
- `BASE_URL`: API endpoint (default: http://localhost:3000)

### Modifying Test Data
Edit the test scripts to customize:
- User registration data
- Application submission content
- Payment amounts and currencies
- File upload simulations

## Best Practices

1. **Warm-up Period**: Always include a warm-up period before collecting metrics
2. **Realistic Data**: Use realistic test data that mimics production usage
3. **Gradual Load Increase**: Ramp up users gradually to avoid sudden spikes
4. **Monitor Resources**: Monitor system resources during testing
5. **Clean Up**: Ensure tests clean up any created test data