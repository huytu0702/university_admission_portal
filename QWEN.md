# University Admission Portal - QWEN Context

## Project Overview

This is a University Admission Portal project designed to demonstrate the impact of various architectural design patterns by allowing toggling between "Before" (baseline) and "After" (improved) implementations. The portal allows applicants to submit applications, make payments, and track processing status. The system showcases the benefits of applying patterns like Queue-Based Load Leveling, Competing Consumers, Priority Queues, Cache-Aside, Idempotency, Retry with Backoff and DLQ, Circuit Breaker, Bulkhead, Outbox, and CQRS-lite.

### Key Features
- **Applicant Flow**: Registration/login, application creation, document upload, immediate payment redirect, status tracking
- **Admin Dashboard**: Feature flag toggling for design patterns, Before/After metrics comparison, DLQ management
- **Burst Handling**: Designed to handle traffic spikes (up to 3,000 RPS) during deadline periods
- **Asynchronous Processing**: Uses queue-based architecture for improved performance and reliability

### Technology Stack
- **Frontend**: Next.js 15 + shadcn UI
- **Backend**: NestJS with modular architecture (auth, applications, payments-mock, health)
- **Database**: PostgreSQL with transaction support, outbox pattern, and read-optimized views
- **Queuing**: Redis + BullMQ for job queues (verify_document, create_payment, send_email)
- **Observability**: OpenTelemetry, Prometheus/Grafana, Loki for metrics and logging
- **Deployment**: Docker Compose for local development

## Architecture Comparison

### Baseline (Synchronous)
- Next.js → NestJS API → PostgreSQL in a single synchronous request
- Higher latency under burst conditions
- Processing steps (upload/verify, payment creation, email sending) happen in one request

### Improved (Queue-Based)
- API path: `POST /applications` writes application + outbox in a DB transaction → Outbox Relay enqueues jobs to BullMQ/Redis
- Workers handle verification, payment, and email tasks in scalable pools
- Client receives 202 Accepted with application_id, status_url, and pay_url
- UI redirects to payment immediately after submission

## Key Design Patterns Implemented
- **Queue-Based Load Leveling** (Required): Uses BullMQ/Redis queues for background processing
- **Competing Consumers**: Multiple workers per job type
- **Priority Queue**: VIP, Normal, Bulk priority levels
- **Cache-Aside**: Redis caching for program catalogs and configs
- **Idempotency Key**: UUID-based request deduplication
- **Retry + Backoff + DLQ**: Automatic retries with exponential backoff and dead letter queues
- **Circuit Breaker**: Payment service protection
- **Bulkhead Isolation**: Separate worker pools with concurrency limits
- **Outbox Pattern**: Transactional message publishing
- **CQRS-lite**: Read-optimized application_view table

## Project Structure
- `PRD.md`: Product Requirements Document with detailed specifications
- `PLANNING.md`: Architecture planning and design decisions
- `TASKS.md`: Milestone-based task breakdown and implementation roadmap
- `DONE.md`: Completed tasks tracking

## Development Milestones
1. **MVP Baseline**: Synchronous application with baseline metrics
2. **Admin Flags + Queue Core**: Introduction of 202 Accepted and queue-based processing
3. **Reliability Pack**: Idempotency, retries, DLQ, circuit breaker, bulkhead isolation
4. **Performance Pack**: Competing consumers, priority queues, comparison dashboards
5. **Read UX & Cache**: Performance optimizations and improved UX
6. **Benchmark & Final Report**: Comprehensive Before/After analysis

## Key Performance Targets
- API submit latency: p95 < 200ms (with 202 Accepted) during burst conditions
- Throughput scales linearly with worker count when Competing Consumers are enabled
- Error rate reduction: ≥60% when Retry+DLQ is enabled
- Cache hit rate: ≥90% when Cache-Aside is enabled

## Building and Running (TBD)
- TODO: Add specific build and run commands based on actual package.json and Docker configuration

## Development Conventions
- Use feature flags to toggle design patterns on/off
- Implement proper monitoring and observability for all patterns
- Follow security best practices (JWT auth, RBAC, file upload scanning)
- Write comprehensive tests (unit, integration, E2E, load tests)