# University Admission Portal

A comprehensive university admission portal demonstrating various architectural design patterns and best practices for building scalable, resilient web applications.

## Overview

This project implements a university admission portal where applicants can register, submit applications with document uploads, process payments, and track their application status. It demonstrates both synchronous processing (baseline) and asynchronous patterns that improve system performance and resilience.

## Key Features

- **User Authentication**: Secure registration and login with JWT tokens
- **Application Management**: Multi-step application submission with file uploads
- **Document Processing**: PDF/JPEG/PNG validation and verification
- **Payment Processing**: Mock payment service with checkout flow
- **Email Notifications**: Automated confirmation emails
- **Status Tracking**: Real-time application progress tracking
- **Responsive UI**: Modern web interface with Tailwind CSS and shadcn/ui

## Technology Stack

### Backend
- **NestJS** - Progressive Node.js framework
- **PostgreSQL** - Relational database
- **Prisma ORM** - Database toolkit
- **Redis** - In-memory data structure store
- **JWT** - Authentication and authorization
- **Docker** - Containerization platform

### Frontend
- **Next.js 15** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library
- **TypeScript** - Typed JavaScript

## Architectural Patterns Demonstrated

### Baseline (Synchronous)
1. Request flows directly to API → Database
2. All processing happens in the request thread
3. Clients wait for all processing to complete

### Enhanced Patterns (Implemented Separately)
1. **Queue-Based Load Leveling** - Offload work to background processors
2. **Competing Consumers** - Scale worker pools horizontally
3. **Cache-Aside** - Reduce database load with caching
4. **Idempotency** - Ensure reliable message processing
5. **Retry with Backoff & DLQ** - Handle transient failures gracefully
6. **Circuit Breaker** - Prevent cascade failures
7. **Bulkhead Isolation** - Limit resource consumption
8. **Outbox Pattern** - Guarantee message delivery
9. **CQRS-lite** - Optimize read-heavy operations

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Docker Desktop
- Git

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd university_admission_portal
```

2. Set up environment files (first time only):
```bash
# On Unix/Linux/macOS
./setup-env.sh

# On Windows
setup-env.bat
```

3. Start the services:
```bash
# On Unix/Linux/macOS
./start.sh

# On Windows
start.bat
```

4. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api

### Manual Setup

See [instructions.md](instructions.md) for detailed setup instructions.

## Project Structure

```
university_admission_portal/
├── backend/                 # NestJS backend application
│   ├── src/                 # Source code
│   │   ├── auth/            # Authentication module
│   │   ├── applications/   # Application processing module
│   │   ├── documents/       # Document handling module
│   │   ├── payments-mock/    # Payment processing module
│   │   ├── emails/          # Email service module
│   │   ├── config/          # Configuration module
│   │   ├── middleware/      # Custom middleware
│   │   ├── filters/         # Exception filters
│   │   ├── metrics/          # Metrics collection
│   │   └── health/          # Health check endpoints
│   ├── prisma/              # Prisma ORM files
│   ├── load-tests/          # Performance testing scripts
│   └── docs/                # Documentation
├── frontend/                # Next.js frontend application
│   ├── src/                 # Source code
│   │   ├── app/             # App router pages
│   │   ├── components/      # Shared components
│   │   └── lib/             # Utility functions
├── docker-compose.yml       # Docker services configuration
└── ...
```

## Performance Testing

The project includes load testing scripts using both k6 and Locust:

```bash
# Using k6
cd backend
k6 run load-tests/comprehensive-k6-test.js

# Using Locust
cd backend
locust -f load-tests/locust-load-test.py
```

## API Documentation

When the backend is running, Swagger API documentation is available at:
```
http://localhost:3001/api
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [NestJS](https://nestjs.com/) and [Next.js](https://nextjs.org/)
- Database powered by [PostgreSQL](https://www.postgresql.org/) and [Prisma](https://www.prisma.io/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Containerized with [Docker](https://www.docker.com/)
- Tested with [k6](https://k6.io/) and [Locust](https://locust.io/)