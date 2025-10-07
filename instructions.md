# University Admission Portal - Instructions

This document provides instructions for setting up and running the University Admission Portal project locally.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

1. **Node.js** (v18 or higher) - https://nodejs.org/
2. **npm** (comes with Node.js)
3. **Docker** - https://www.docker.com/products/docker-desktop
4. **Git** - https://git-scm.com/
5. **Python 3** (for Locust load testing) - https://www.python.org/downloads/

## Project Structure

```
university_admission_portal/
├── backend/                 # NestJS backend application
├── frontend/                # Next.js frontend application
├── docker-compose.yml       # Docker Compose configuration
├── init.sql                 # Database initialization script
├── start.sh/start.bat       # Scripts to start the application
├── stop.sh/stop.bat         # Scripts to stop the application
├── init.sh/init.bat         # Scripts to initialize the application
├── load-test.sh/load-test.bat # Scripts to run load tests
└── ...
```

## Quick Start

### Using the Initialization Scripts (Recommended)

#### On Unix/Linux/macOS:
```bash
# Initialize the project
./init.sh

# Start the application
./start.sh

# Stop the application
./stop.sh
```

#### On Windows:
```cmd
# Initialize the project
init.bat

# Start the application
start.bat

# Stop the application
stop.bat
```

## Manual Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Copy the example environment file and adjust as needed:
```bash
cp .env.example .env
```

Edit the `.env` file to match your configuration:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/admission_portal?schema=public
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1d
PORT=3000
UPLOAD_DIR=./uploads
```

4. Start Docker services:
From the root project directory:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis server on port 6379

5. Run database migrations:
```bash
npx prisma migrate dev --name init
```

6. Generate Prisma client:
```bash
npx prisma generate
```

7. Start the backend server:
```bash
npm run start:dev
```

The backend API will be available at `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Running Tests

### Unit Tests
```bash
cd backend
npm run test
```

### Integration Tests
```bash
cd backend
npm run test:e2e
```

### Load Tests

#### Using the Load Test Scripts (Recommended)

##### On Unix/Linux/macOS:
```bash
./load-test.sh
```

##### On Windows:
```cmd
load-test.bat
```

#### Manual Load Testing

##### Using k6
Install k6:
```bash
npm install -g k6
```

Run load tests:
```bash
cd backend
k6 run load-tests/comprehensive-k6-test.js
```

##### Using Locust
Install Locust:
```bash
pip install locust
```

Run load tests:
```bash
cd backend
locust -f load-tests/locust-load-test.py
```

Then open `http://localhost:8089` in your browser to access the Locust web interface.

## API Documentation

Once the backend is running, you can access the Swagger API documentation at:
```
http://localhost:3001/api
```

## Database Access

To access the PostgreSQL database directly:
```bash
docker exec -it university_admission_db psql -U postgres -d admission_portal
```

## Stopping Services

### Using the Stop Scripts (Recommended)

#### On Unix/Linux/macOS:
```bash
./stop.sh
```

#### On Windows:
```cmd
stop.bat
```

### Manual Stopping

To stop all Docker services:
```bash
docker-compose down
```

To stop the backend/frontend development servers, press `Ctrl+C` in their respective terminals.

## Troubleshooting

### Common Issues

1. **Port conflicts**: If ports 3000, 3001, 5432, or 6379 are already in use, update the `docker-compose.yml` and `.env` files to use different ports.

2. **Database connection errors**: Ensure Docker is running and the database container is started before running migrations.

3. **Permission denied errors**: On Linux/macOS, you might need to run Docker commands with `sudo`.

4. **Prisma generation errors**: Run `npx prisma generate` after any schema changes.

### Useful Commands

- View Docker containers: `docker ps`
- View Docker logs: `docker-compose logs`
- Restart Docker containers: `docker-compose restart`
- Remove Docker containers: `docker-compose down -v` (removes volumes as well)

## Development Workflow

1. Make sure Docker services are running (`docker-compose up -d`)
2. Start the backend (`npm run start:dev` in backend directory)
3. Start the frontend (`npm run dev` in frontend directory)
4. Make code changes - both servers will automatically reload
5. Run tests as needed
6. When finished, stop all services (`docker-compose down`)

## Production Deployment

For production deployment, you would:

1. Set proper environment variables for production
2. Use a production database (not Dockerized PostgreSQL)
3. Build optimized versions of both applications:
   ```bash
   # Backend
   npm run build
   
   # Frontend
   npm run build
   ```
4. Serve the applications behind a reverse proxy (nginx, Apache, etc.)
5. Set up proper SSL certificates
6. Configure monitoring and logging solutions

Note: This project is intended for demonstration and educational purposes. For a production environment, additional security measures, backup procedures, and monitoring would be required.


🚀 Các lệnh hữu ích:
Xem database bằng Prisma Studio:
cd backend
npx prisma studio
Kiểm tra trạng thái container:
docker ps
Dừng database:
docker-compose down
Khởi động lại database:
docker-compose up -d postgres
Backup database:
Database của bạn đã sẵn sàng sử dụng! Bạn có thể chạy backend server bằng lệnh:
cd backend
npm run start:dev