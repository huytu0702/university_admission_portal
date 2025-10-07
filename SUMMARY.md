# University Admission Portal - System Summary (Milestone 1)

## Overview

The University Admission Portal is a comprehensive system designed to demonstrate various architectural design patterns and best practices for building scalable, resilient web applications. Milestone 1 implements the baseline synchronous version with core functionality including user authentication, application submission, payment processing, and email notifications.

## Key Features (Milestone 1 - Baseline Implementation)

### Applicant Functionality
- **User Authentication**: Secure registration and login with JWT tokens
- **Application Management**: Multi-step application submission with file uploads
- **Document Processing**: PDF/JPEG/PNG validation and verification (synchronous)
- **Payment Processing**: Mock payment service with checkout flow (synchronous)
- **Email Notifications**: Automated confirmation emails (synchronous)
- **Status Tracking**: Application status tracking with progress indicators
- **Responsive UI**: Modern web interface with Tailwind CSS and shadcn/ui

## Functional Requirements (Milestone 1)

### For Applicants
- Register and authenticate securely
- Submit application forms with multi-step workflow
- Upload required documents (PDF/JPEG/PNG) with validation
- Submit application with synchronous processing
- Track application status (created, submitted, verified, paid, completed)
- Receive email notifications for status changes
- View processing progress with percentage indicators

### Core API Endpoints (Milestone 1)
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `POST /auth/refresh` - Token refresh
- `POST /applications` - Submit application (synchronous processing)
- `GET /applications/:id` - Retrieve application status
- `POST /payments/checkout` - Initiate payment process (mock)
- `POST /webhooks/payment` - Handle payment confirmation (mock)
- `POST /upload` - File upload endpoint

## Non-Functional Requirements (Milestone 1)

### Performance
- Synchronous processing with higher latency during burst conditions
- Response times may increase significantly under load
- Baseline performance metrics captured for future comparison

### Reliability
- Synchronous processing means failure in any step results in overall request failure
- No retry mechanisms implemented
- Error handling within the request thread

### Security
- JWT-based authentication with access and refresh tokens
- RBAC with distinct roles (applicant)
- File upload validation (MIME type, size)
- Input validation and sanitization
- CORS configuration
- Password hashing (Argon2/bcrypt)

### Observability
- Request logging middleware
- Basic error tracking
- Metrics collection for latency
- Endpoint response time tracking
- Health check endpoint

## Implemented Design Patterns (Milestone 1)

### Current Implementation (Synchronous)
- **Synchronous Processing**: All operations (upload/verify, payment creation, email sending) happen in single request thread
- **Monolithic Architecture**: All functionality implemented in single API service
- **Direct Database Access**: Synchronous operations with PostgreSQL via Prisma ORM
- **JWT Authentication**: Token-based authentication and authorization
- **Form Validation**: Input validation at API level
- **File Upload Validation**: Client and server-side validation for file types and sizes

## Technology Stack (Milestone 1)

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Typed JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Reusable component library

### Backend
- **NestJS**: Progressive Node.js framework
- **TypeScript**: Typed server-side development
- **JWT**: Authentication and authorization

### Database & Storage
- **PostgreSQL**: Relational database for persistent storage
- **Prisma ORM**: Database toolkit and type-safe ORM

### Infrastructure
- **Docker**: Containerization platform
- **Docker Compose**: Multi-container orchestration

### Testing & Documentation
- **Jest**: Unit and integration testing
- **Swagger/OpenAPI**: API documentation

## Performance Baseline (Milestone 1)

- API submit latency: p95 > 3-10 seconds during burst conditions
- Throughput: Limited by synchronous processing
- Error rate: Higher during burst conditions
- Resource utilization: Higher during peak loads due to synchronous blocking operations