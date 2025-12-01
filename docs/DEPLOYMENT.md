# Deployment Guide

## Overview
The University Admission Portal is designed to be deployed using **Docker Compose**. This ensures a consistent environment across development and production.

## Prerequisites
- Docker
- Docker Compose
- Node.js (for local development without Docker)

## Services
The system consists of the following services:
1.  **Backend**: NestJS application (Port 3001).
2.  **Frontend**: Next.js application (Port 3000).
3.  **Database**: PostgreSQL (Port 5432).
4.  **Nginx**: Reverse proxy (Port 80/443).

## Environment Variables
Create a `.env` file in the root directory (or respective service directories) with the following keys:

### Backend
```env
DATABASE_URL="postgresql://user:password@db:5432/dbname?schema=public"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="1d"
PORT=3001
```

### Frontend
```env
NEXT_PUBLIC_API_URL="http://localhost:80/api" # Or domain in production
```

## Running with Docker Compose

### Development
To start the application in development mode:
```bash
docker-compose up --build
```
This will start all services and stream logs to the console.

### Production
To start in production mode (detached):
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Running Locally (Without Docker)

### 1. Database
Ensure you have a PostgreSQL instance running. Update `DATABASE_URL` in `backend/.env` to point to it.

### 2. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Troubleshooting
- **Database Connection**: Ensure the `DATABASE_URL` is correct and the database container is healthy.
- **Port Conflicts**: Ensure ports 3000, 3001, and 80 are free.
