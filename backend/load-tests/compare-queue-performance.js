import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const userRegistrations = new Counter('user_registrations');
const applicationSubmissions = new Counter('application_submissions');
const paymentProcesses = new Counter('payment_processes');
const statusQueries = new Counter('status_queries');
const errorRate = new Rate('errors');

const registrationDuration = new Trend('registration_duration', true);
const loginDuration = new Trend('login_duration', true);
const applicationSubmissionDuration = new Trend('application_submission_duration', true);
const paymentProcessingDuration = new Trend('payment_processing_duration', true);
const statusQueryDuration = new Trend('status_query_duration', true);

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'; // Using port 3001 for backend API
const FEATURE_MODE = __ENV.FEATURE_MODE || 'baseline'; // 'baseline' for sync, 'improved' for async

export const options = {
  scenarios: {
    smoke_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      gracefulStop: '30s',
      exec: 'smokeTest',
    },
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'stressTest',
    },
  },
  thresholds: {
    // For baseline (synchronous) - thresholds are more lenient
    'http_req_duration': ['p(95)<5000'],  // More lenient for baseline
    // Error rate should be below 10% (more lenient for baseline)
    'errors': ['rate<0.10'],
    // 99th percentile response time should be below 10000ms (more lenient)
    'http_req_duration': ['p(99)<10000'],
    // Checks should pass at least 90% of the time (more lenient)
    'checks': ['rate>0.90'],
  },
};

// User data generator
function generateUserData() {
  const randomString = Math.random().toString(36).substring(2, 10);
  return {
    email: `test_${randomString}@example.com`,
    password: 'TestPass123!',
    firstName: `FirstName_${randomString}`,
    lastName: `LastName_${randomString}`,
  };
}

// Main scenario - Typical user journey
export function smokeTest() {
  group('User Journey', function () {
    // Step 1: Register new user
    const userData = generateUserData();
    const registerRes = registerUser(userData);
    
    if (registerRes.status !== 201) {
      errorRate.add(1);
      return;
    }
    
    userRegistrations.add(1);
    
    // Step 2: Login with registered user
    const loginRes = loginUser(userData);
    
    if (loginRes.status !== 200) {
      errorRate.add(1);
      return;
    }
    
    const authToken = loginRes.json('access_token');
    
    // Step 3: Submit application
    const applicationRes = submitApplication(authToken);
    
    // Handle different responses based on feature mode
    let applicationId = null;
    
    if (FEATURE_MODE === 'baseline') {
      // Baseline: synchronous processing, expect 201
      if (applicationRes.status !== 201) {
        errorRate.add(1);
        return;
      }
      applicationId = applicationRes.json('id');
    } else {
      // Improved: queue-based processing, expect 202
      if (applicationRes.status !== 202) {
        errorRate.add(1);
        return;
      }
      applicationId = applicationRes.json('applicationId');
    }
    
    applicationSubmissions.add(1);
    
    // Step 4: In queue-based mode, we may want to check the status
    if (FEATURE_MODE === 'improved') {
      // Wait a little bit for the queue processing to start
      sleep(2);
      
      // Check status periodically
      for (let i = 0; i < 10; i++) {
        const statusRes = checkApplicationStatus(authToken, applicationId);
        if (statusRes.status === 200) {
          statusQueries.add(1);
          const statusData = statusRes.json();
          if (statusData.status === 'completed' || statusData.status === 'verified' || statusData.status === 'payment_initiated') {
            break; // Stop polling if application is processed
          }
        }
        sleep(1); // Wait 1 second between checks
      }
    }
    
    // Step 5: Initiate payment
    const paymentRes = initiatePayment(authToken, applicationId);
    
    if (paymentRes.status !== 200) {
      errorRate.add(1);
      return;
    }
    
    paymentProcesses.add(1);
  });
  
  // Simulate user thinking time
  sleep(Math.random() * 3 + 1);
}

// Stress test function
export function stressTest() {
  smokeTest(); // For now, reuse the same test logic for stress testing
}

// Function to register a new user
function registerUser(userData) {
  const startTime = new Date().getTime();
  
  const payload = JSON.stringify({
    email: userData.email,
    password: userData.password,
    firstName: userData.firstName,
    lastName: userData.lastName,
  });
  
  const res = http.post(`${BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'RegisterUser' },
  });
  
  const endTime = new Date().getTime();
  registrationDuration.add(endTime - startTime);
  
  check(res, {
    'user registration status is 201': (r) => r.status === 201,
  });
  
  return res;
}

// Function to login a user
function loginUser(userData) {
  const startTime = new Date().getTime();
  
  const payload = JSON.stringify({
    email: userData.email,
    password: userData.password,
  });
  
  const res = http.post(`${BASE_URL}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'LoginUser' },
  });
  
  const endTime = new Date().getTime();
  loginDuration.add(endTime - startTime);
  
  check(res, {
    'user login status is 200': (r) => r.status === 200,
    'login response has access_token': (r) => r.json('access_token') !== undefined,
  });
  
  return res;
}

// Function to submit an application
function submitApplication(authToken) {
  const startTime = new Date().getTime();
  
  // Using form data for potential file uploads
  const formData = {
    personalStatement: 'This is a comprehensive personal statement that demonstrates the applicant\'s qualifications, experiences, and motivations for pursuing higher education. The statement highlights academic achievements, extracurricular activities, community involvement, and career aspirations. It also discusses challenges overcome and lessons learned that have shaped the individual\'s character and determination to succeed in their chosen field of study.',
  };
  
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'SubmitApplication' },
  };
  
  const res = http.post(`${BASE_URL}/applications`, formData, params);
  
  const endTime = new Date().getTime();
  applicationSubmissionDuration.add(endTime - startTime);
  
  // Check for appropriate response based on feature mode
  if (FEATURE_MODE === 'baseline') {
    check(res, {
      'application submission status is 201 (baseline)': (r) => r.status === 201,
      'application response has ID': (r) => r.json('id') !== undefined,
    });
  } else {
    check(res, {
      'application submission status is 202 (improved)': (r) => r.status === 202,
      'application response has applicationId': (r) => r.json('applicationId') !== undefined,
    });
  }
  
  return res;
}

// Function to check application status (only for queue-based implementation)
function checkApplicationStatus(authToken, applicationId) {
  const startTime = new Date().getTime();
  
  const res = http.get(`${BASE_URL}/applications/${applicationId}/status`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'CheckApplicationStatus' },
  });
  
  const endTime = new Date().getTime();
  statusQueryDuration.add(endTime - startTime);
  
  return res;
}

// Function to initiate payment
function initiatePayment(authToken, applicationId) {
  const startTime = new Date().getTime();
  
  const payload = JSON.stringify({
    applicationId: applicationId,
    amount: 7500, // $75.00
    currency: 'usd',
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'InitiatePayment' },
  };
  
  const res = http.post(`${BASE_URL}/payments/checkout`, payload, params);
  
  const endTime = new Date().getTime();
  paymentProcessingDuration.add(endTime - startTime);
  
  check(res, {
    'payment initiation status is 200': (r) => r.status === 200,
    'payment response has paymentIntentId': (r) => r.json('paymentIntentId') !== undefined,
  });
  
  return res;
}

// Handle summary results
export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-test-results.json': JSON.stringify(data),
  };
}