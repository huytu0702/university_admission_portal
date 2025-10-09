# University Admission Portal - Setup and Running Instructions

This document provides comprehensive instructions for setting up and running the University Admission Portal project locally. This fullstack application consists of a Next.js frontend and NestJS backend with PostgreSQL database and Redis for queuing.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

1. **Node.js** (v18 or higher) - https://nodejs.org/
2. **npm** (comes with Node.js)
3. **Docker Desktop** (with Docker Compose) - https://www.docker.com/products/docker-desktop
4. **Git** - https://git-scm.com/
5. **Python 3** (for Locust load testing) - https://www.python.org/downloads/ (optional)

## Project Structure

```
university_admission_portal/
├── backend/                 # NestJS backend application
├── frontend/                # Next.js frontend application
├── nginx/                   # Nginx reverse proxy configuration
├── docker-compose.yml       # Main Docker Compose configuration
├── docker-compose.override.yml # Development-specific Docker overrides
├── docker-compose.prod.yml  # Production-specific Docker configuration
├── scripts/
│   ├── init.sh/init.bat     # Initialize the project
│   ├── start.sh/start.bat   # Start the application
│   ├── stop.sh/stop.bat     # Stop the application
│   └── load-test.sh/load-test.bat # Run load tests
└── ...
```

## Database Schema

The database schema is defined using Prisma ORM in `backend/prisma/schema.prisma` and managed through Prisma migrations in `backend/prisma/migrations/`.
```

## Quick Start (Recommended)

The easiest way to run the project is using the initialization scripts:

### On Unix/Linux/macOS:
```bash
# Initialize the project (first time only)
./init.sh

# Start the application
./start.sh

# Stop the application when done
./stop.sh
```

### On Windows:
```cmd
# Initialize the project (first time only)
init.bat

# Start the application
start.bat

# Stop the application when done
stop.bat
```

After starting, the application will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- API Documentation: `http://localhost:3001/api`
- Admin Dashboard: `http://localhost:3000/admin`

## Manual Setup (Detailed Steps)

If you prefer to set up the project manually or understand the process better, follow these steps:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd university_admission_portal
```

### 2. Set up Environment Variables

Create `.env` files for both frontend and backend:

**Backend (.env in backend/ directory):**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/admission_portal?schema=public
JWT_SECRET=your_jwt_secret_key_here_must_be_long_and_complex
JWT_EXPIRES_IN=1d
PORT=3001
UPLOAD_DIR=./uploads
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

**Frontend (.env.local in frontend/ directory):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

### 3. Start Infrastructure Services

From the project root directory, start Docker services:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database on port 5432 (schema applied via Prisma migrations, not init.sql)
- Redis server on port 6379
- Nginx reverse proxy on port 3000
- MailHog for email testing on port 8025

Note: Database schema is managed through Prisma migrations that are applied separately after the database container starts.

### 4. Set up Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed the database (optional)
npx prisma db seed

# Start the backend server in development mode
npm run start:dev
```

The backend API will be available at `http://localhost:3001`

### 5. Set up Frontend

Open a new terminal/command prompt and run:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Running the Application

### Using Docker (Recommended for Production)

For a containerized deployment, build and run using Docker:

```bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# View logs
docker-compose logs -f
```

### Development Mode

For development, use the setup described above with separate frontend and backend development servers. This provides hot reloading and faster development cycle.

## Testing the Application

### Backend Tests

```bash
cd backend

# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run coverage report
npm run test:cov
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Load Testing

The project includes load testing scripts:

```bash
# Using k6
cd backend
k6 run load-tests/comprehensive-k6-test.js

# Using Locust (requires Python and locust installed)
cd backend
locust -f load-tests/locust-load-test.py
```

Then open `http://localhost:8089` in your browser to access the Locust web interface.

## API Documentation

Once the backend is running, you can access the Swagger API documentation at:
- `http://localhost:3001/api`

## Database Management

### Prisma Studio (GUI for Database)
```bash
cd backend
npx prisma studio
```

### Direct Database Access
```bash
# Access PostgreSQL directly
docker exec -it university_admission_db psql -U postgres -d admission_portal
```

### Database Setup and Migrations
```bash
# Run database migrations (creates tables based on schema.prisma)
cd backend
npx prisma migrate dev --name init

# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration after schema changes
npx prisma migrate dev --name descriptive-migration-name

# Apply pending migrations (in production)
npx prisma migrate deploy

# Reset database to schema (development only)
npx prisma migrate reset
```

## Queue Management (BullMQ + Redis)

The application uses Redis and BullMQ for background job processing:

- Job Dashboard: `http://localhost:3000/admin/queues` (when running)
- Process documents, send emails, and create payments asynchronously
- Configure worker processes in the admin panel

## Admin Dashboard Features

The admin dashboard provides:

1. **Feature Flag Management**: Toggle design patterns (Queue-based, Caching, Retry, etc.)
2. **Performance Metrics**: Compare before/after implementation metrics
3. **Queue Monitoring**: View and manage job queues
4. **DLQ Management**: Handle dead letter queue items
5. **System Monitoring**: Health checks and system status

Access at: `http://localhost:3000/admin` (credentials in your .env file)

## Production Deployment

For production deployment:

1. Set proper environment variables for production
2. Use managed database services (not Dockerized PostgreSQL)
3. Configure SSL certificates for HTTPS
4. Use environment-specific docker-compose files
5. Set up monitoring, logging, and alerting
6. Configure backup procedures for the database

### Environment Variables for Production
```
# Backend production variables
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@managed-db-host:5432/dbname
JWT_SECRET=production_secret_key
REDIS_URL=redis://managed-redis-host:6379

# Frontend production variables
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_BACKEND_URL=https://yourdomain.com
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 3000, 3001, 5432, or 6379 are in use, update `docker-compose.yml` and environment files
2. **Permission errors**: On Linux/macOS, you might need `sudo` for Docker commands
3. **Database connection errors**: Ensure Docker is running and database container is started
4. **Frontend can't connect to backend**: Check that the API URL in frontend .env is correct
5. **Prisma errors**: Run `npx prisma generate` after schema changes
6. **Memory issues**: Increase Docker's memory allocation (minimum 4GB recommended)

### Useful Commands

```bash
# View running containers
docker ps

# View container logs
docker-compose logs

# View specific container logs
docker-compose logs backend  # or frontend, postgres, redis

# Restart all services
docker-compose restart

# Clean up containers and volumes
docker-compose down -v

# Check system resources
docker stats

# Connect to database
docker exec -it university_admission_db psql -U postgres -d admission_portal
```

### Reset Development Environment

If you encounter persistent issues, you can reset your development environment:

```bash
# Stop all services
./stop.sh  # or stop.bat on Windows

# Remove all containers and volumes
docker-compose down -v

# Clean up any generated files
cd backend && rm -rf dist/ && cd ../frontend && rm -rf .next/ && cd ..

# Re-initialize
./init.sh  # or init.bat on Windows
```

## Architecture Overview

### Design Patterns Implemented

1. **Queue-Based Load Leveling**: Background processing with BullMQ
2. **Competing Consumers**: Scalable worker pools
3. **Cache-Aside**: Redis caching for performance
4. **Idempotency**: Prevent duplicate requests
5. **Retry with Backoff**: Handle transient failures
6. **Circuit Breaker**: Protect downstream services
7. **Bulkhead Isolation**: Resource isolation
8. **Outbox Pattern**: Reliable message delivery
9. **CQRS-lite**: Optimized read operations

### Application Flow

1. User submits application via frontend
2. Frontend makes API call to backend
3. Backend stores application in DB within transaction + Outbox pattern
4. Outbox Relay publishes jobs to Redis/BullMQ queues
5. Workers process jobs (document verification, payment, email)
6. Status updates are reflected in the database
7. Frontend polls for status updates or receives via WebSocket

## Development Workflow

1. Ensure Docker services are running: `docker-compose up -d`
2. Start backend: `cd backend && npm run start:dev`
3. Start frontend: `cd frontend && npm run dev`
4. Access admin panel at `http://localhost:3000/admin` to toggle features
5. Make code changes - both servers will automatically reload
6. Run tests as needed: `npm test` in respective directories
7. When finished: `docker-compose down`

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Make your changes with proper testing
4. Ensure all tests pass
5. Commit your changes: `git commit -m 'Add some AmazingFeature'`
6. Push to the branch: `git push origin feature/AmazingFeature`
7. Open a pull request

## Support

If you encounter issues not covered in this document:

1. Check the project's GitHub Issues
2. Review the detailed documentation in the `docs/` directory
3. Contact the project maintainers
4. Create an issue in the repository with detailed information about your problem


admin@example.com admin123