import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const activeUsers = new Gauge('active_users');
const throughput = new Counter('throughput');
const errorRate = new Rate('errors');
const memoryLeakIndicator = new Trend('response_time_degradation', true);

// Baseline metrics for comparison
let baselineResponseTime = 0;
let currentResponseTime = 0;

// Test options for sustained load (soak test)
export const options = {
  scenarios: {
    // Short soak test - 10 minutes
    short_soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      gracefulStop: '30s',
    },
    // Medium soak test - 30 minutes
    medium_soak: {
      executor: 'constant-vus',
      vus: 75,
      duration: '30m',
      gracefulStop: '1m',
      startTime: '11m',  // Start after short soak
    },
    // Long soak test - 1 hour (comment out for quick tests)
    // long_soak: {
    //   executor: 'constant-vus',
    //   vus: 100,
    //   duration: '60m',
    //   gracefulStop: '1m',
    //   startTime: '42m',
    // },
    // Endurance test with gradual increase
    endurance_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 50 },     // Warm up
        { duration: '15m', target: 100 },   // Increase load
        { duration: '20m', target: 150 },   // High sustained load
        { duration: '10m', target: 50 },    // Cool down
        { duration: '5m', target: 0 },      // Ramp down
      ],
      gracefulRampDown: '1m',
      startTime: '42m',  // Start after medium soak
    },
  },
  thresholds: {
    // Sustained load should maintain good performance
    'http_req_duration': ['p(95)<800'],
    // Error rate must stay low throughout
    'errors': ['rate<0.02'],
    // Response time should not degrade more than 50% over time
    'response_time_degradation': ['p(95)<2000'],
    'checks': ['rate>0.98'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Time tracking for degradation analysis
const testStartTime = new Date().getTime();
let samplesCollected = 0;

// User data generator
function generateUserData() {
  const randomString = Math.random().toString(36).substring(2, 15);
  return {
    email: `sustained_test_${randomString}@example.com`,
    password: 'Sustained123!',
    firstName: `Sustained_${randomString}`,
    lastName: `User_${randomString}`,
  };
}

// Main sustained load test scenario
export default function () {
  const elapsedMinutes = (new Date().getTime() - testStartTime) / 60000;
  
  group('Sustained Load Test - Full Journey', function () {
    // Update active users gauge
    activeUsers.set(__VU);
    
    // Step 1: Register and login
    const userData = generateUserData();
    const registerRes = registerUser(userData);
    
    if (registerRes.status !== 201) {
      errorRate.add(1);
      return;
    }
    
    const loginRes = loginUser(userData);
    
    if (loginRes.status !== 200) {
      errorRate.add(1);
      return;
    }
    
    const authToken = loginRes.json('access_token');
    
    // Step 2: Submit multiple applications (simulate heavy usage)
    for (let i = 0; i < 3; i++) {
      const appStartTime = new Date().getTime();
      const applicationRes = submitApplication(authToken, i);
      const appEndTime = new Date().getTime();
      const appDuration = appEndTime - appStartTime;
      
      if (applicationRes.status === 201 || applicationRes.status === 202) {
        throughput.add(1);
        
        // Track response time degradation
        if (samplesCollected < 100) {
          // Collect baseline in first 100 requests
          baselineResponseTime = (baselineResponseTime * samplesCollected + appDuration) / (samplesCollected + 1);
          samplesCollected++;
        } else {
          // Compare current response time to baseline
          currentResponseTime = appDuration;
          const degradation = ((currentResponseTime - baselineResponseTime) / baselineResponseTime) * 100;
          memoryLeakIndicator.add(degradation);
          
          if (degradation > 50) {
            console.log(`⚠️ Performance degradation detected: ${degradation.toFixed(2)}% at ${elapsedMinutes.toFixed(1)} minutes`);
          }
        }
        
        const applicationId = applicationRes.json('id');
        
        // Step 3: Poll application status multiple times
        for (let j = 0; j < 2; j++) {
          sleep(1); // Wait before polling
          const statusRes = getApplicationStatus(authToken, applicationId);
          
          if (statusRes.status !== 200) {
            errorRate.add(1);
          }
        }
        
        // Step 4: Initiate payment
        const paymentRes = initiatePayment(authToken, applicationId);
        
        if (paymentRes.status === 200) {
          throughput.add(1);
        } else {
          errorRate.add(1);
        }
      } else {
        errorRate.add(1);
      }
      
      // Short pause between applications
      sleep(2);
    }
  });
  
  // Simulate realistic user think time
  sleep(Math.random() * 5 + 3);
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
    tags: { name: 'RegisterUser', test: 'sustained' },
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
    tags: { name: 'LoginUser', test: 'sustained' },
  });
  
  check(res, {
    'login successful': (r) => r.status === 200,
    'has access token': (r) => r.json('access_token') !== undefined,
  });
  
  return res;
}

// Function to submit application
function submitApplication(authToken, iteration) {
  const formData = {
    personalStatement: `Sustained load test application #${iteration}. This is a comprehensive statement that simulates real user data entry. It contains multiple paragraphs and detailed information to simulate realistic payload sizes that would be submitted in a production environment.`,
  };
  
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'SubmitApplication', test: 'sustained' },
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
    tags: { name: 'GetApplicationStatus', test: 'sustained' },
  });
  
  check(res, {
    'status retrieved': (r) => r.status === 200,
  });
  
  return res;
}

// Function to initiate payment
function initiatePayment(authToken, applicationId) {
  const payload = JSON.stringify({
    applicationId: applicationId,
    amount: 7500,
    currency: 'usd',
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'InitiatePayment', test: 'sustained' },
  };
  
  const res = http.post(`${BASE_URL}/payments/checkout`, payload, params);
  
  check(res, {
    'payment initiated': (r) => r.status === 200,
  });
  
  return res;
}

// Handle summary for sustained load test results
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const testDuration = (new Date().getTime() - testStartTime) / 60000;
  
  let summary = {
    timestamp: timestamp,
    duration_minutes: testDuration.toFixed(2),
    baseline_response_time: baselineResponseTime.toFixed(2),
    metrics: data.metrics,
    root_group: data.root_group,
  };
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    [`sustained-load-test-results-${timestamp}.json`]: JSON.stringify(summary, null, 2),
  };
}

// Helper function for text summary
function textSummary(data, options) {
  const indent = options.indent || '';
  
  let summary = `\n${indent}Sustained Load Test Results\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;
  
  const metrics = data.metrics;
  
  summary += `${indent}Test Duration: ${((new Date().getTime() - testStartTime) / 60000).toFixed(2)} minutes\n`;
  summary += `${indent}Baseline Response Time: ${baselineResponseTime.toFixed(2)}ms\n\n`;
  
  if (metrics.http_req_duration) {
    summary += `${indent}Request Duration:\n`;
    summary += `${indent}  - Average: ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}  - p95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}  - p99: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }
  
  if (metrics.response_time_degradation) {
    summary += `${indent}Performance Degradation:\n`;
    summary += `${indent}  - Average: ${metrics.response_time_degradation.values.avg.toFixed(2)}%\n`;
    summary += `${indent}  - p95: ${metrics.response_time_degradation.values['p(95)'].toFixed(2)}%\n\n`;
  }
  
  if (metrics.errors) {
    summary += `${indent}Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;
  }
  
  if (metrics.throughput) {
    summary += `${indent}Total Throughput: ${metrics.throughput.values.count} operations\n`;
  }
  
  return summary;
}
