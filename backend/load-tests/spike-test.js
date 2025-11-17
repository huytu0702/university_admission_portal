import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const errorRate = new Rate('errors');
const recoveryTime = new Trend('recovery_time', true);

// Test options for spike testing
export const options = {
  scenarios: {
    // Spike scenario: Sudden increase in load
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },    // Normal load
        { duration: '10s', target: 200 },   // Spike to 200 users
        { duration: '1m', target: 200 },    // Hold spike
        { duration: '10s', target: 10 },    // Drop back to normal
        { duration: '1m', target: 10 },     // Recovery period
        { duration: '10s', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
    },
    // Double spike scenario: Two consecutive spikes
    double_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },    // Normal load
        { duration: '10s', target: 150 },   // First spike
        { duration: '30s', target: 150 },   // Hold
        { duration: '10s', target: 20 },    // Partial recovery
        { duration: '20s', target: 20 },    // Brief normal
        { duration: '10s', target: 180 },   // Second spike (higher)
        { duration: '30s', target: 180 },   // Hold
        { duration: '10s', target: 0 },     // Complete drop
      ],
      gracefulRampDown: '30s',
      startTime: '4m',  // Start after first spike test
    },
  },
  thresholds: {
    // Allow higher latency during spike
    'http_req_duration': ['p(95)<2000'],
    // Error rate should recover after spike
    'errors': ['rate<0.05'],
    // Most requests should still succeed
    'http_req_duration': ['p(99)<5000'],
    'checks': ['rate>0.90'],  // 90% success rate acceptable during spike
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Track spike detection
let spikeStartTime = 0;
let spikeEndTime = 0;
let inSpike = false;

// User data generator
function generateUserData() {
  const randomString = Math.random().toString(36).substring(2, 15);
  return {
    email: `spike_test_${randomString}@example.com`,
    password: 'SpikeTest123!',
    firstName: `Spike_${randomString}`,
    lastName: `User_${randomString}`,
  };
}

// Main spike test scenario
export default function () {
  const currentVUs = __VU;
  
  // Detect when spike starts (VU count increases rapidly)
  if (currentVUs > 100 && !inSpike) {
    inSpike = true;
    spikeStartTime = new Date().getTime();
    console.log(`Spike detected at ${spikeStartTime}, VU count: ${currentVUs}`);
  }
  
  // Detect when spike ends
  if (currentVUs < 50 && inSpike) {
    inSpike = false;
    spikeEndTime = new Date().getTime();
    const recovery = spikeEndTime - spikeStartTime;
    recoveryTime.add(recovery);
    console.log(`Spike ended, duration: ${recovery}ms`);
  }
  
  group('Spike Test - User Journey', function () {
    // Step 1: Health check (lightweight)
    const healthRes = http.get(`${BASE_URL}/health`, {
      tags: { name: 'HealthCheck' },
    });
    
    check(healthRes, {
      'health check is 200': (r) => r.status === 200,
    }) ? successfulRequests.add(1) : (failedRequests.add(1), errorRate.add(1));
    
    // Step 2: Register new user
    const userData = generateUserData();
    const registerRes = registerUser(userData);
    
    if (registerRes.status !== 201) {
      failedRequests.add(1);
      errorRate.add(1);
      return; // Exit early on failure
    }
    
    successfulRequests.add(1);
    
    // Step 3: Login
    const loginRes = loginUser(userData);
    
    if (loginRes.status !== 200) {
      failedRequests.add(1);
      errorRate.add(1);
      return;
    }
    
    successfulRequests.add(1);
    const authToken = loginRes.json('access_token');
    
    // Step 4: Submit application (most critical operation)
    const applicationRes = submitApplication(authToken);
    
    if (applicationRes.status === 201 || applicationRes.status === 202) {
      successfulRequests.add(1);
      
      const applicationId = applicationRes.json('id');
      
      // Step 5: Check application status
      const statusRes = getApplicationStatus(authToken, applicationId);
      
      if (statusRes.status === 200) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
        errorRate.add(1);
      }
    } else {
      failedRequests.add(1);
      errorRate.add(1);
    }
  });
  
  // Variable sleep to simulate realistic user behavior
  // During spike, users might retry faster
  sleep(inSpike ? Math.random() * 0.5 + 0.1 : Math.random() * 2 + 1);
}

// Function to register a new user
function registerUser(userData) {
  const payload = JSON.stringify({
    email: userData.email,
    password: userData.password,
    firstName: userData.firstName,
    lastName: userData.lastName,
  });
  
  const res = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'RegisterUser', spike: inSpike },
    timeout: '30s',  // Increased timeout for spike conditions
  });
  
  check(res, {
    'registration successful': (r) => r.status === 201,
  });
  
  return res;
}

// Function to login
function loginUser(userData) {
  const payload = JSON.stringify({
    email: userData.email,
    password: userData.password,
  });
  
  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'LoginUser', spike: inSpike },
    timeout: '30s',
  });
  
  check(res, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('access_token') !== undefined,
  });
  
  return res;
}

// Function to submit application
function submitApplication(authToken) {
  const formData = {
    personalStatement: 'Spike test application - testing system resilience under sudden load increase.',
  };
  
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'SubmitApplication', spike: inSpike },
    timeout: '60s',  // Longer timeout for application submission
  };
  
  const res = http.post(`${BASE_URL}/applications`, formData, params);
  
  check(res, {
    'application submitted': (r) => r.status === 201 || r.status === 202,
    'has application id': (r) => r.json('id') !== undefined,
  });
  
  return res;
}

// Function to get application status
function getApplicationStatus(authToken, applicationId) {
  const res = http.get(`${BASE_URL}/applications/${applicationId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'GetApplicationStatus', spike: inSpike },
    timeout: '30s',
  });
  
  check(res, {
    'status retrieved': (r) => r.status === 200,
  });
  
  return res;
}

// Handle summary for spike test results
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [`spike-test-results-${timestamp}.json`]: JSON.stringify(data, null, 2),
  };
}

// Helper function for text summary
function textSummary(data, options) {
  const indent = options.indent || '';
  const colors = options.enableColors;
  
  let summary = `\n${indent}Spike Test Results\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  // Metrics summary
  const metrics = data.metrics;
  
  if (metrics.http_req_duration) {
    summary += `${indent}Request Duration:\n`;
    summary += `${indent}  - Average: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  - p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}  - p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }
  
  if (metrics.errors) {
    summary += `${indent}Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  if (metrics.successful_requests) {
    summary += `${indent}Successful Requests: ${metrics.successful_requests.values.count}\n`;
  }
  
  if (metrics.failed_requests) {
    summary += `${indent}Failed Requests: ${metrics.failed_requests.values.count}\n\n`;
  }
  
  return summary;
}
