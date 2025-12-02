# University Admission Portal API Documentation

## Overview
This document describes the REST API endpoints for the University Admission Portal system.

## Base URL
```
http://localhost:3001
```

## Authentication
All API endpoints (except registration and login) require JWT authentication via Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account in the system.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201 Created):**
```json
{
  "id": "d403fd70-65c3-428c-9359-72fc88cea2a4",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "applicant",
  "createdAt": "2025-12-01T17:35:59.180Z",
  "updatedAt": "2025-12-01T17:35:59.180Z"
}
```

**Error Responses:**
- `400` - Invalid input data
- `409` - Email already exists
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### Login User
**POST** `/auth/login`

Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "d403fd70-65c3-428c-9359-72fc88cea2a4",
    "email": "user@example.com",
    "role": "applicant"
  }
}
```

**Error Responses:**
- `400` - Invalid credentials
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## Application Endpoints

### Create Application
**POST** `/applications`

Create a new university application.

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer <jwt-token>
```

**Request Body:**
```
personalStatement=This is my personal statement explaining why I want to attend this university...
```

**Response (201 Created):**
```json
{
  "applicationId": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
  "statusUrl": "/applications/ff8c05da-d250-4db7-99fa-c5cd41c3785e/status",
  "payUrl": "/payments/checkout/ff8c05da-d250-4db7-99fa-c5cd41c3785e"
}
```

**Error Responses:**
- `400` - Invalid input
- `401` - Unauthorized
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### Get Application Details
**GET** `/applications/{id}`

Retrieve detailed information about a specific application.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Path Parameters:**
- `id` - Application UUID

**Response (200 OK):**
```json
{
  "id": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
  "userId": "d403fd70-65c3-428c-9359-72fc88cea2a4",
  "status": "payment_initiated",
  "personalStatement": "This is my personal statement...",
  "createdAt": "2025-12-01T17:36:14.714Z",
  "updatedAt": "2025-12-01T17:36:16.039Z",
  "progress": 75,
  "applicationFiles": [],
  "payment": {
    "id": "00a79884-0183-499d-9ceb-859c59f120cb",
    "applicationId": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
    "paymentIntentId": "pi_mock_1764610576027_dcaqq2cw2",
    "amount": 7500,
    "currency": "usd",
    "status": "pending",
    "paymentUrl": "http://localhost:3000/payment/pi_mock_1764610576027_dcaqq2cw2",
    "provider": "mock",
    "createdAt": "2025-12-01T17:36:14.750Z",
    "updatedAt": "2025-12-01T17:36:16.027Z"
  }
}
```

**Error Responses:**
- `400` - Invalid application ID
- `401` - Unauthorized
- `403` - Access denied (not application owner)
- `404` - Application not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### Get Application Status
**GET** `/applications/{id}/status`

Get the current status of an application.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Path Parameters:**
- `id` - Application UUID

**Response (200 OK):**
```json
{
  "id": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
  "status": "payment_completed",
  "progress": 100,
  "createdAt": "2025-12-01T17:36:14.714Z",
  "updatedAt": "2025-12-01T17:36:16.039Z"
}
```

**Error Responses:**
- `400` - Invalid application ID
- `401` - Unauthorized
- `404` - Application not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## Payment Endpoints

### Initiate Payment
**POST** `/payments/checkout`

Create a payment intent for an application.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "applicationId": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
  "amount": 5000,
  "currency": "usd"
}
```

**Response (200 OK):**
```json
{
  "id": "00a79884-0183-499d-9ceb-859c59f120cb",
  "paymentIntentId": "pi_mock_1764610595691_6vggo30j7",
  "amount": 5000,
  "currency": "usd",
  "status": "pending",
  "paymentUrl": "http://localhost:3000/payment/pi_mock_1764610595691_6vggo30j7"
}
```

**Error Responses:**
- `400` - Invalid payment data
- `401` - Unauthorized
- `403` - Access denied (not application owner)
- `409` - Payment already exists for this application
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### Get Payment Status
**GET** `/payments/{paymentIntentId}/status`

Check the status of a payment.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Path Parameters:**
- `paymentIntentId` - Payment intent ID from payment provider

**Response (200 OK):**
```json
{
  "paymentIntentId": "pi_mock_1764610595691_6vggo30j7",
  "status": "succeeded",
  "amount": 5000,
  "currency": "usd",
  "applicationId": "ff8c05da-d250-4db7-99fa-c5cd41c3785e",
  "createdAt": "2025-12-01T17:36:14.750Z",
  "updatedAt": "2025-12-01T17:36:16.027Z"
}
```

**Error Responses:**
- `400` - Invalid payment intent ID
- `401` - Unauthorized
- `404` - Payment not found
- `429` - Rate limit exceeded
- `500` - Internal server error

---

## Error Response Format

All error responses follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-01T17:35:59.180Z",
  "path": "/auth/register",
  "message": "Validation failed"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Global limit**: 100 requests per minute per IP
- **Specific endpoints**: May have lower limits
- **Headers included**:
  - `X-RateLimit-Limit`: Request limit per window
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

When rate limited, you'll receive a `429 Too Many Requests` response.

## Security Headers

All responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'...`

## CORS

The API supports Cross-Origin Resource Sharing for:
- `http://localhost:3000` (frontend development server)
- Production domains as configured

---

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "role": "applicant|admin|reviewer",
  "createdAt": "iso8601",
  "updatedAt": "iso8601"
}
```

### Application
```json
{
  "id": "uuid",
  "userId": "uuid",
  "status": "draft|payment_initiated|payment_completed|under_review|approved|rejected",
  "personalStatement": "string",
  "progress": 0-100,
  "applicationFiles": ["file_ids"],
  "createdAt": "iso8601",
  "updatedAt": "iso8601",
  "payment": "PaymentObject|null"
}
```

### Payment
```json
{
  "id": "uuid",
  "applicationId": "uuid",
  "paymentIntentId": "string",
  "amount": "number",
  "currency": "string",
  "status": "pending|succeeded|failed|cancelled",
  "paymentUrl": "string",
  "provider": "string",
  "createdAt": "iso8601",
  "updatedAt": "iso8601"
}
```

---

## Testing

For testing purposes, you can use the following:
- **Base URL**: `http://localhost:3001`
- **Test User**: `loadtest-user-1@example.com` with password `TestPass123!`
- **Payment Provider**: Mock provider for testing

The load test script `k6-load-test.js` demonstrates API usage patterns.