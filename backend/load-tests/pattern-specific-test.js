import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for pattern-specific monitoring
const queuedApplications = new Counter('queued_applications');
const synchronousApplications = new Counter('synchronous_applications');
const retryAttempts = new Counter('retry_attempts');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

const queueProcessingTime = new Trend('queue_processing_time', true);
const retrySuccessRate = new Rate('retry_success_rate');
const patternErrorRate = new Rate('pattern_errors');

// Test configuration
export const options = {
  scenarios: {
    // Test 1: Queue-Based Load Leveling Pattern
    queue_leveling_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'testQueueLeveling',
    },
    // Test 2: Outbox Pattern (Transactional)
    outbox_pattern_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '2m',
      gracefulStop: '30s',
      exec: 'testOutboxPattern',
      startTime: '2m30s',
    },
    // Test 3: Retry with Exponential Backoff
    retry_pattern_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      gracefulStop: '30s',
      exec: 'testRetryPattern',
      startTime: '5m',
    },
    // Test 4: Circuit Breaker Pattern
    circuit_breaker_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 40 },   // Trigger failures
        { duration: '30s', target: 10 },  // Allow recovery
        { duration: '30s', target: 0 },
      ],
      exec: 'testCircuitBreaker',
      startTime: '7m30s',
    },
    // Test 5: Cache-Aside Pattern
    cache_pattern_test: {
      executor: 'constant-vus',
      vus: 40,
      duration: '2m',
      gracefulStop: '30s',
      exec: 'testCachePattern',
      startTime: '10m',
    },
    // Test 6: Competing Consumers (Concurrency)
    competing_consumers_test: {
      executor: 'constant-arrival-rate',
      rate: 100,  // 100 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'testCompetingConsumers',
      startTime: '12m30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'pattern_errors': ['rate<0.03'],
    'checks': ['rate>0.95'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin123!';

// Helper: Generate user data
function generateUserData(prefix = 'pattern_test') {
  const randomString = Math.random().toString(36).substring(2, 15);
  return {
    email: `${prefix}_${randomString}@example.com`,
    password: 'Pattern123!',
    firstName: `Pattern_${randomString}`,
    lastName: `Test_${randomString}`,
  };
}

// Helper: Register and login
function authenticateUser(userData) {
  const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(userData), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (registerRes.status !== 201) {
    return null;
  }
  
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: userData.email,
    password: userData.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginRes.status === 200) {
    return loginRes.json('access_token');
  }
  
  return null;
}

// Test 1: Queue-Based Load Leveling Pattern
export function testQueueLeveling() {
  group('Queue-Based Load Leveling', function () {
    const userData = generateUserData('queue');
    const token = authenticateUser(userData);
    
    if (!token) {
      patternErrorRate.add(1);
      return;
    }
    
    // Submit application that should be queued
    const startTime = new Date().getTime();
    
    const res = http.post(`${BASE_URL}/applications`, {
      personalStatement: 'Testing queue-based load leveling pattern for asynchronous processing.',
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { pattern: 'queue-leveling' },
    });
    
    const accepted = check(res, {
      'application accepted (202)': (r) => r.status === 202,
      'has application id': (r) => r.json('id') !== undefined,
      'has status url': (r) => r.json('statusUrl') !== undefined,
    });
    
    if (accepted) {
      queuedApplications.add(1);
      
      const applicationId = res.json('id');
      const statusUrl = res.json('statusUrl');
      
      // Poll for completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 20;
      
      while (!completed && attempts < maxAttempts) {
        sleep(2);
        attempts++;
        
        const statusRes = http.get(`${BASE_URL}${statusUrl}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (statusRes.status === 200) {
          const status = statusRes.json('status');
          
          if (status === 'completed' || status === 'COMPLETED') {
            completed = true;
            const endTime = new Date().getTime();
            queueProcessingTime.add(endTime - startTime);
          } else if (status === 'failed' || status === 'FAILED') {
            patternErrorRate.add(1);
            break;
          }
        }
      }
      
      check(completed, {
        'application processed within time limit': (c) => c === true,
      });
    } else {
      patternErrorRate.add(1);
    }
  });
  
  sleep(1);
}

// Test 2: Outbox Pattern
export function testOutboxPattern() {
  group('Outbox Pattern (Transactional)', function () {
    const userData = generateUserData('outbox');
    const token = authenticateUser(userData);
    
    if (!token) {
      patternErrorRate.add(1);
      return;
    }
    
    // Submit application with outbox pattern enabled
    const res = http.post(`${BASE_URL}/applications`, {
      personalStatement: 'Testing outbox pattern for reliable message delivery.',
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'X-Enable-Outbox': 'true',  // Custom header to test pattern
      },
      tags: { pattern: 'outbox' },
    });
    
    check(res, {
      'application accepted': (r) => r.status === 201 || r.status === 202,
      'transaction committed': (r) => r.headers['X-Transaction-Id'] !== undefined,
    }) || patternErrorRate.add(1);
    
    // Verify eventual consistency
    if (res.status === 202) {
      const applicationId = res.json('id');
      sleep(3);  // Wait for outbox relay
      
      const statusRes = http.get(`${BASE_URL}/applications/${applicationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      check(statusRes, {
        'eventual consistency achieved': (r) => r.status === 200,
      }) || patternErrorRate.add(1);
    }
  });
  
  sleep(1);
}

// Test 3: Retry with Exponential Backoff
export function testRetryPattern() {
  group('Retry with Exponential Backoff', function () {
    const userData = generateUserData('retry');
    const token = authenticateUser(userData);
    
    if (!token) {
      patternErrorRate.add(1);
      return;
    }
    
    // Submit application that might fail and retry
    const res = http.post(`${BASE_URL}/applications`, {
      personalStatement: 'Testing retry pattern with exponential backoff.',
      simulateFailure: Math.random() < 0.3,  // 30% chance of failure
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'X-Enable-Retry': 'true',
      },
      tags: { pattern: 'retry' },
    });
    
    const retryCount = parseInt(res.headers['X-Retry-Count'] || '0');
    
    if (retryCount > 0) {
      retryAttempts.add(retryCount);
    }
    
    const success = check(res, {
      'application submitted after retries': (r) => r.status === 201 || r.status === 202,
      'retry count reasonable': (r) => retryCount <= 3,
    });
    
    retrySuccessRate.add(success ? 1 : 0);
    
    if (!success) {
      patternErrorRate.add(1);
    }
  });
  
  sleep(1);
}

// Test 4: Circuit Breaker Pattern
export function testCircuitBreaker() {
  group('Circuit Breaker Pattern', function () {
    const userData = generateUserData('circuit');
    const token = authenticateUser(userData);
    
    if (!token) {
      patternErrorRate.add(1);
      return;
    }
    
    // Make payment request that might trigger circuit breaker
    const res = http.post(`${BASE_URL}/payments/checkout`, JSON.stringify({
      applicationId: 'test-app-id',
      amount: 5000,
      currency: 'usd',
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      tags: { pattern: 'circuit-breaker' },
    });
    
    const circuitState = res.headers['X-Circuit-State'];
    
    if (circuitState === 'open') {
      circuitBreakerTrips.add(1);
      
      check(res, {
        'circuit breaker open - fast fail': (r) => r.status === 503,
        'has retry-after header': (r) => r.headers['Retry-After'] !== undefined,
      });
    } else {
      check(res, {
        'request processed': (r) => r.status === 200 || r.status === 500,
      }) || patternErrorRate.add(1);
    }
  });
  
  sleep(1);
}

// Test 5: Cache-Aside Pattern
export function testCachePattern() {
  group('Cache-Aside Pattern', function () {
    // First request - should miss cache and fetch from DB
    const res1 = http.get(`${BASE_URL}/programs`, {
      tags: { pattern: 'cache', request: 'first' },
    });
    
    const firstCached = res1.headers['X-Cache-Hit'] === 'true';
    
    if (firstCached) {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
    
    check(res1, {
      'first request successful': (r) => r.status === 200,
    });
    
    // Second request - should hit cache
    sleep(0.5);
    
    const res2 = http.get(`${BASE_URL}/programs`, {
      tags: { pattern: 'cache', request: 'second' },
    });
    
    const secondCached = res2.headers['X-Cache-Hit'] === 'true';
    
    if (secondCached) {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
    
    check(res2, {
      'second request successful': (r) => r.status === 200,
      'cache hit on second request': (r) => r.headers['X-Cache-Hit'] === 'true',
      'faster than first request': (r) => r.timings.duration < res1.timings.duration,
    });
  });
  
  sleep(1);
}

// Test 6: Competing Consumers
export function testCompetingConsumers() {
  group('Competing Consumers Pattern', function () {
    const userData = generateUserData('consumer');
    const token = authenticateUser(userData);
    
    if (!token) {
      patternErrorRate.add(1);
      return;
    }
    
    // Submit high volume of applications
    const res = http.post(`${BASE_URL}/applications`, {
      personalStatement: 'Testing competing consumers for parallel processing.',
    }, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { pattern: 'competing-consumers' },
    });
    
    check(res, {
      'application queued': (r) => r.status === 202,
      'assigned to worker': (r) => r.headers['X-Worker-Id'] !== undefined,
    }) || patternErrorRate.add(1);
  });
  
  // No sleep - high throughput test
}

// Summary handler
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  
  const summary = {
    timestamp: timestamp,
    patterns_tested: [
      'Queue-Based Load Leveling',
      'Outbox Pattern',
      'Retry with Exponential Backoff',
      'Circuit Breaker',
      'Cache-Aside',
      'Competing Consumers',
    ],
    metrics: {
      queued_applications: data.metrics.queued_applications?.values.count || 0,
      synchronous_applications: data.metrics.synchronous_applications?.values.count || 0,
      retry_attempts: data.metrics.retry_attempts?.values.count || 0,
      circuit_breaker_trips: data.metrics.circuit_breaker_trips?.values.count || 0,
      cache_hits: data.metrics.cache_hits?.values.count || 0,
      cache_misses: data.metrics.cache_misses?.values.count || 0,
      retry_success_rate: data.metrics.retry_success_rate?.values.rate || 0,
      pattern_error_rate: data.metrics.pattern_errors?.values.rate || 0,
    },
    raw_data: data,
  };
  
  return {
    'stdout': textSummary(summary),
    [`pattern-specific-test-results-${timestamp}.json`]: JSON.stringify(summary, null, 2),
  };
}

function textSummary(summary) {
  let text = `\n${'='.repeat(60)}\n`;
  text += `Pattern-Specific Load Test Results\n`;
  text += `${'='.repeat(60)}\n\n`;
  text += `Timestamp: ${summary.timestamp}\n\n`;
  
  text += `Patterns Tested:\n`;
  summary.patterns_tested.forEach((pattern, index) => {
    text += `  ${index + 1}. ${pattern}\n`;
  });
  text += `\n`;
  
  text += `Pattern Metrics:\n`;
  text += `  - Queued Applications: ${summary.metrics.queued_applications}\n`;
  text += `  - Retry Attempts: ${summary.metrics.retry_attempts}\n`;
  text += `  - Circuit Breaker Trips: ${summary.metrics.circuit_breaker_trips}\n`;
  text += `  - Cache Hits: ${summary.metrics.cache_hits}\n`;
  text += `  - Cache Misses: ${summary.metrics.cache_misses}\n`;
  text += `  - Retry Success Rate: ${(summary.metrics.retry_success_rate * 100).toFixed(2)}%\n`;
  text += `  - Pattern Error Rate: ${(summary.metrics.pattern_error_rate * 100).toFixed(2)}%\n\n`;
  
  const cacheTotal = summary.metrics.cache_hits + summary.metrics.cache_misses;
  if (cacheTotal > 0) {
    const hitRate = (summary.metrics.cache_hits / cacheTotal * 100).toFixed(2);
    text += `Cache Performance:\n`;
    text += `  - Hit Rate: ${hitRate}%\n\n`;
  }
  
  return text;
}
