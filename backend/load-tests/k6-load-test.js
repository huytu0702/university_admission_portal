import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const applicationCreations = new Counter('application_creations');
const paymentInitiations = new Counter('payment_initiations');
const errorRate = new Rate('errors');
const applicationCreationDuration = new Trend('application_creation_duration', true);
const paymentInitiationDuration = new Trend('payment_initiation_duration', true);

// Test options
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    // 95th percentile response time should be below 500ms
    'http_req_duration': ['p(95)<500'],
    // Error rate should be below 1%
    'errors': ['rate<0.01'],
    // 99th percentile response time should be below 1000ms
    'http_req_duration': ['p(99)<1000'],
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'TestPass123!';
const TEST_FILES = [
  { name: 'transcript.pdf', content: new Array(1024).join('A'), mime_type: 'application/pdf' },
  { name: 'id_card.jpg', content: new Array(512).join('B'), mime_type: 'image/jpeg' },
];

// Global variables
let authToken = '';
let applicationId = '';

// Setup function to authenticate and prepare test data
export function setup() {
  // Register a test user
  const registerPayload = JSON.stringify({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    firstName: 'Test',
    lastName: 'User',
  });
  
  const registerRes = http.post(`${BASE_URL}/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(registerRes, {
    'user registered successfully': (r) => r.status === 201,
  }) || errorRate.add(1);
  
  // Login to get auth token
  const loginPayload = JSON.stringify({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginRes, {
    'user logged in successfully': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  authToken = loginRes.json('access_token');
  
  return { authToken };
}

// Main test function
export default function (data) {
  const { authToken } = data;
  
  // Scenario 1: Create application with files
  createApplication(authToken);
  
  // Scenario 2: Get application details
  if (applicationId) {
    getApplicationDetails(authToken, applicationId);
  }
  
  // Scenario 3: Initiate payment
  if (applicationId) {
    initiatePayment(authToken, applicationId);
  }
  
  // Add some sleep to simulate realistic user behavior
  sleep(1);
}

// Function to create an application
function createApplication(authToken) {
  const startTime = new Date().getTime();
  
  // Create multipart form data
  const formData = {
    personalStatement: 'This is a test personal statement for the university application. It contains detailed information about the applicant\'s background, achievements, and motivations for pursuing higher education.',
  };
  
  const files = TEST_FILES.map(file => ({
    name: 'files',
    file: file.content,
    filename: file.name,
    contentType: file.mime_type,
  }));
  
  const params = {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'CreateApplication' },
  };
  
  const res = http.post(`${BASE_URL}/applications`, formData, params);
  
  const endTime = new Date().getTime();
  const duration = endTime - startTime;
  
  applicationCreationDuration.add(duration);
  
  check(res, {
    'application created successfully': (r) => r.status === 201,
    'application has ID': (r) => r.json('id') !== undefined,
  }) || errorRate.add(1);
  
  if (res.status === 201) {
    applicationId = res.json('id');
    applicationCreations.add(1);
  }
  
  return res;
}

// Function to get application details
function getApplicationDetails(authToken, appId) {
  const res = http.get(`${BASE_URL}/applications/${appId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    tags: { name: 'GetApplicationDetails' },
  });
  
  check(res, {
    'application details retrieved successfully': (r) => r.status === 200,
    'application ID matches': (r) => r.json('id') === appId,
  }) || errorRate.add(1);
  
  return res;
}

// Function to initiate payment
function initiatePayment(authToken, appId) {
  const startTime = new Date().getTime();
  
  const payload = JSON.stringify({
    applicationId: appId,
    amount: 5000, // $50.00
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
  const duration = endTime - startTime;
  
  paymentInitiationDuration.add(duration);
  
  check(res, {
    'payment initiated successfully': (r) => r.status === 200,
    'payment intent has ID': (r) => r.json('paymentIntentId') !== undefined,
  }) || errorRate.add(1);
  
  if (res.status === 200) {
    paymentInitiations.add(1);
  }
  
  return res;
}

// Teardown function to clean up test data
export function teardown(data) {
  // In a real test, you might want to clean up test data
  // For now, we'll just log that the test completed
  console.log('Load test completed');
}