# Backend Architecture

## Overview
The backend is built using the **NestJS** framework, providing a modular, scalable, and testable architecture. It uses **TypeScript** for type safety and **Prisma** as the ORM for database interactions.

## Key Technologies
- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **API Documentation**: Swagger (OpenAPI)
- **Authentication**: Passport & JWT

## Module Structure
The application is organized into feature-based modules:

### Core Modules
- **AppModule**: The root module that imports all other modules.
- **ConfigModule**: Manages configuration using environment variables.
- **SecurityModule**: Configures security best practices (Helmet, CORS, Rate Limiting).

### Feature Modules
- **AuthModule**: Handles user authentication (Login, Register) and JWT token generation.
- **ApplicationsModule**: Manages university applications, including status updates and submission.
- **DocumentsModule**: Handles file uploads and document management for applications.
- **EmailModule**: Manages email notifications.
- **PaymentMockModule**: Simulates payment processing.
- **MetricsModule**: Collects and exposes application metrics.
- **HealthModule**: Provides health check endpoints.
- **FeatureFlagsModule**: Manages feature flags for gradual rollout.
- **ReadModelModule**: Implements CQRS read models for optimized querying.

## Database Schema
The database schema is defined in `prisma/schema.prisma`. Key models include:
- **User**: Stores user account information.
- **Application**: Represents a university admission application.
- **ApplicationFile**: Stores metadata for uploaded files.
- **Payment**: Tracks payment status for applications.
- **Email**: Logs sent emails.

## API Documentation
The API is documented using Swagger.
- **Local URL**: `http://localhost:3001/api`
- **Authentication**: Most endpoints require a Bearer Token (JWT).

## Security
- **Authentication**: JWT-based authentication using `PassportModule`.
- **Authorization**: Role-based access control (RBAC) can be implemented using Guards.
- **Data Protection**: Passwords are hashed before storage.
- **Middleware**:
    - `RequestLoggingMiddleware`: Logs incoming requests.
    - `MetricsCollectionMiddleware`: Collects performance metrics.
