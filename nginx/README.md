# Nginx Configuration

## Overview
Nginx acts as a reverse proxy and load balancer for the University Admission Portal. It handles incoming requests and routes them to the appropriate service (Backend or Frontend).

## Configuration File
The main configuration is located at `nginx.conf`.

### Key Features

#### 1. Reverse Proxy
- **Backend**: Requests starting with `/api` (implied, or default routing) are forwarded to the backend service on port `3001`.
- **Frontend**: Other requests are forwarded to the frontend service on port `3000`.

#### 2. Upstream Servers
Defines the backend and frontend service locations, typically using Docker service names:
```nginx
upstream backend {
    server backend:3001;
}

upstream frontend {
    server frontend:3000;
}
```

#### 3. Rate Limiting
Protects the API from abuse.
- **API Zone**: `10r/s` (10 requests per second) for general API endpoints.
- **Login Zone**: `1r/s` (1 request per second) for login endpoints to prevent brute force attacks.

#### 4. Compression
Gzip compression is enabled for text-based assets (CSS, JS, XML, JSON) to improve performance.

#### 5. Security Headers
(Recommended to add if not present)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`

## Usage
This configuration is typically used within a Docker container. The `nginx` service in `docker-compose.yml` mounts this configuration file.
