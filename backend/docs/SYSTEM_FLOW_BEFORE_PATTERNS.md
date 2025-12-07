# University Admission Portal - System Architecture & Flow

## Overview

This document describes the system architecture and flow of the University Admission Portal backend, built with NestJS framework.

## System Architecture

```mermaid
graph TB
    Client[Frontend Client] --> Gateway[API Gateway/Nginx]
    Gateway --> App[NestJS Application]
    
    App --> Auth[Auth Module]
    App --> Apps[Applications Module]
    App --> Payments[Payment Module]
    App --> Docs[Documents Module]
    App --> Email[Email Module]
    App --> Health[Health Module]
    App --> Metrics[Metrics Module]
    
    Auth --> DB[(PostgreSQL Database)]
    Apps --> DB
    Payments --> DB
    Docs --> DB
    Email --> DB
    
    Apps --> FileStorage[File System Storage]
    Docs --> FileStorage
    
    subgraph "Security Layer"
        JWT[JWT Strategy]
        Guards[Route Guards]
        Security[Security Config]
    end
    
    Auth --> JWT
    App --> Guards
    App --> Security
```

## Module Structure

```mermaid
graph LR
    Main[main.ts] --> AppModule[app.module.ts]
    
    AppModule --> ConfigModule[config/]
    AppModule --> AuthModule[auth/]
    AppModule --> ApplicationsModule[applications/]
    AppModule --> DocumentsModule[documents/]
    AppModule --> PaymentModule[payments-mock/]
    AppModule --> EmailModule[email/]
    AppModule --> HealthModule[health/]
    AppModule --> MetricsModule[metrics/]
    
    AuthModule --> AuthService[auth.service.ts]
    AuthModule --> AuthController[auth.controller.ts]
    
    ApplicationsModule --> ApplicationsService[applications.service.ts]
    ApplicationsModule --> ApplicationController[applications.controller.ts]
    ApplicationsModule --> ApplicationStatusService[application-status.service.ts]
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant Database
    participant JWT
    
    Client->>AuthController: POST /auth/register
    AuthController->>AuthService: register(email, password, firstName, lastName)
    AuthService->>Database: Create user with hashed password
    Database-->>AuthService: User created
    AuthService-->>AuthController: User registration success
    AuthController-->>Client: 201 Created
    
    Client->>AuthController: POST /auth/login
    AuthController->>AuthService: login(email, password)
    AuthService->>Database: Find user by email
    Database-->>AuthService: User found
    AuthService->>AuthService: Verify password
    AuthService->>JWT: Generate JWT token
    JWT-->>AuthService: Token generated
    AuthService-->>AuthController: Login success with token
    AuthController-->>Client: 200 OK with JWT token
    
    Note over Client,JWT: All subsequent requests include JWT token in Authorization header
```

## Application Submission Flow

```mermaid
sequenceDiagram
    participant Client
    participant ApplicationController
    participant ApplicationsService
    participant DocumentService
    participant EmailService
    participant Database
    participant FileStorage
    
    Client->>ApplicationController: POST /applications (with files)
    ApplicationController->>ApplicationsService: createApplication(userId, data, files)
    
    ApplicationsService->>Database: Create application record
    Database-->>ApplicationsService: Application created
    
    ApplicationsService->>FileStorage: Store uploaded files
    FileStorage-->>ApplicationsService: Files stored
    
    ApplicationsService->>Database: Create file records
    Database-->>ApplicationsService: File records created
    
    ApplicationsService->>DocumentService: verifyAllDocumentsForApplication(applicationId)
    DocumentService->>Database: Update file verification status
    Database-->>DocumentService: Files verified
    DocumentService-->>ApplicationsService: Verification complete
    
    ApplicationsService->>EmailService: sendApplicationConfirmation(email, applicationId)
    EmailService->>Database: Log email sent
    Database-->>EmailService: Email logged
    EmailService-->>ApplicationsService: Email sent
    
    ApplicationsService-->>ApplicationController: Application created successfully
    ApplicationController-->>Client: 201 Created with application details
```

## Payment Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant PaymentController
    participant PaymentService
    participant ApplicationsService
    participant Database
    participant EmailService
    
    Client->>PaymentController: POST /payments/checkout
    PaymentController->>ApplicationsService: Verify application ownership
    ApplicationsService->>Database: Check application belongs to user
    Database-->>ApplicationsService: Ownership verified
    ApplicationsService-->>PaymentController: Ownership confirmed
    
    PaymentController->>PaymentService: createPaymentIntent(paymentData)
    PaymentService->>Database: Create payment intent record
    Database-->>PaymentService: Payment intent created
    PaymentService-->>PaymentController: Payment intent details
    
    PaymentController-->>Client: Payment intent details
    
    Note over Client,PaymentService: Payment processed by external provider
    
    Client->>PaymentController: GET /payments/confirm/:paymentIntentId
    PaymentController->>PaymentService: confirmPayment(paymentIntentId)
    PaymentService->>Database: Update payment status
    Database-->>PaymentService: Payment confirmed
    PaymentService->>EmailService: sendPaymentConfirmation(email, applicationId)
    EmailService->>Database: Log email sent
    Database-->>EmailService: Email logged
    EmailService-->>PaymentService: Email sent
    PaymentService-->>PaymentController: Payment confirmed
    PaymentController-->>Client: Payment confirmation
```

## Application Status Tracking Flow

```mermaid
sequenceDiagram
    participant Client
    participant ApplicationController
    participant ApplicationStatusService
    participant Database
    
    Client->>ApplicationController: GET /applications/:id/status
    ApplicationController->>ApplicationStatusService: getApplicationStatus(applicationId)
    ApplicationStatusService->>Database: Query application status
    Database-->>ApplicationStatusService: Status details
    ApplicationStatusService-->>ApplicationController: Status information
    ApplicationController-->>Client: Application status
    
    Client->>ApplicationController: GET /applications/:id/progress
    ApplicationController->>ApplicationStatusService: calculateProgressPercentage(applicationId)
    ApplicationStatusService->>Database: Query application and file status
    Database-->>ApplicationStatusService: Application data
    ApplicationStatusService->>ApplicationStatusService: Calculate progress percentage
    ApplicationStatusService-->>ApplicationController: Progress percentage
    ApplicationController-->>Client: Progress information
```

## Middleware & Security Flow

```mermaid
sequenceDiagram
    participant Request
    participant SecurityMiddleware
    participant MetricsMiddleware
    participant LoggingMiddleware
    participant RouteGuard
    participant Controller
    participant ExceptionFilter
    
    Request->>SecurityMiddleware: CORS, Rate limiting, Security headers
    SecurityMiddleware->>MetricsMiddleware: Request metrics collection
    MetricsMiddleware->>LoggingMiddleware: Request logging
    LoggingMiddleware->>RouteGuard: JWT validation
    RouteGuard->>Controller: Process request
    Controller-->>RouteGuard: Response
    RouteGuard-->>LoggingMiddleware: Response
    LoggingMiddleware-->>MetricsMiddleware: Response metrics
    MetricsMiddleware-->>SecurityMiddleware: Response
    SecurityMiddleware-->>Request: Final response
    
    Note over Request,ExceptionFilter: If any error occurs
    Controller->>ExceptionFilter: Error thrown
    ExceptionFilter-->>Request: Formatted error response
```

## Database Schema Relationships

```mermaid
erDiagram
    User ||--o{ Application : creates
    User ||--o{ Payment : makes
    Application ||--o{ ApplicationFile : contains
    Application ||--o{ Payment : requires
    Application ||--o{ Email : receives
    ApplicationFile ||--o{ Email : related
    
    User {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        datetime createdAt
        datetime updatedAt
    }
    
    Application {
        string id PK
        string userId FK
        string personalStatement
        string status
        datetime createdAt
        datetime updatedAt
    }
    
    ApplicationFile {
        string id PK
        string applicationId FK
        string fileName
        string filePath
        string fileType
        int fileSize
        boolean verified
        datetime createdAt
    }
    
    Payment {
        string id PK
        string applicationId FK
        string userId FK
        int amount
        string currency
        string status
        string paymentIntentId UK
        datetime createdAt
        datetime updatedAt
    }
    
    Email {
        string id PK
        string toAddress
        string subject
        string status
        string applicationId FK
        datetime createdAt
    }
```

## Key Features & Components

### 1. Authentication & Authorization
- JWT-based authentication
- Password hashing with bcrypt
- Route guards for protected endpoints
- Token refresh mechanism

### 2. Application Management
- Multi-file upload support (up to 5 files)
- Document verification process
- Status tracking with progress calculation
- Personal statement support

### 3. Payment Processing
- Mock payment integration
- Payment intent creation and confirmation
- Webhook handling for payment events
- Payment status tracking

### 4. Communication
- Email notifications for application events
- Email logging in database
- Template-based email content

### 5. Monitoring & Health
- Metrics collection middleware
- Health check endpoints
- Request logging
- Exception handling filters

### 6. Security
- CORS configuration
- Rate limiting
- Input validation with class-validator
- SQL injection prevention with Prisma ORM

## API Endpoints Summary

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Token refresh
- `GET /auth/profile` - Get user profile

### Applications
- `POST /applications` - Create application with files
- `GET /applications` - Get user applications
- `GET /applications/:id` - Get specific application
- `GET /applications/:id/status` - Get application status
- `GET /applications/:id/progress` - Get application progress
- `GET /applications/:applicationId/files/:fileId` - Download application file

### Payments
- `POST /payments/checkout` - Create payment intent
- `GET /payments/confirm/:paymentIntentId` - Confirm payment
- `GET /payments/:paymentIntentId/status` - Get payment status
- `POST /payments/webhook` - Handle payment webhooks

### Health & Monitoring
- `GET /health` - Health check
- `GET /metrics` - Application metrics

## Technology Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **File Storage**: Local file system
- **Email**: Nodemailer (mock configuration)
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, Rate limiting
- **Monitoring**: Custom metrics collection