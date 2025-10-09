# M2 Pattern Implementation Documentation

This document details the implementation of two key architectural patterns in the University Admission Portal: Queue-Based Load Leveling and Outbox Pattern.

## Queue-Based Load Leveling Pattern

### Overview
The Queue-Based Load Leveling pattern is implemented using BullMQ (a Node.js job queue library) and Redis as the backend. This pattern helps handle traffic spikes (up to 3,000 RPS) during application deadline periods by de-coupling the synchronous processing steps.

### Implementation Files

1. **Queue Producer Service** (`src/feature-flags/queue/queue-producer.service.ts`)
   - Defines the main service for adding jobs to queues
   - Includes three queues: `verify_document`, `create_payment`, and `send_email`
   - Supports priority-based job processing (low, normal, high, critical)
   - Maps string priorities to numeric values for BullMQ priority system

2. **Feature Flags Module** (`src/feature-flags/feature-flags.module.ts`)
   - Registers the BullMQ queues with Redis configuration
   - Configures Redis connection using environment variables
   - Includes the queue producer service in the module providers

3. **Worker Services** (`src/feature-flags/workers/`)
   - `document-verification.worker.ts`: Processes document verification jobs
   - `payment-processing.worker.ts`: Handles payment creation jobs
   - `email-sending.worker.ts`: Manages email sending jobs
   - Each worker is a BullMQ processor that handles specific job types

4. **Feature Flag Seeder** (`src/feature-flags/feature-flags-seeder.service.ts`)
   - Creates the `queue-based-load-leveling` feature flag with description: "Queue-Based Load Leveling (BullMQ/Redis) - Required pattern"

### Architecture Flow

1. When a new application is submitted, instead of processing all steps synchronously:
   - Application data is saved to the database
   - Outbox messages are created (see Outbox Pattern below)
   - API immediately returns 202 Accepted with application ID, status URL, and payment URL

2. Outbox relay service processes messages and enqueues jobs to appropriate queues based on event type:
   - `document_uploaded` → verify_document queue
   - `application_submitted` → create_payment queue
   - `payment_completed` → send_email queue

3. Worker processes pick up jobs from queues and perform the actual processing:
   - Document verification worker handles document validation
   - Payment processing worker creates payment records
   - Email sending worker sends notifications

### Priority System
The system implements a priority system with four levels:
- `critical` (priority 0): Highest priority
- `high` (priority 1)
- `normal` (priority 2)
- `low` (priority 3): Lowest priority

## Outbox Pattern

### Overview
The Outbox Pattern ensures reliable message publishing by storing messages in the same database transaction as the business operation. This prevents data inconsistency where business operations succeed but message publishing fails.

### Implementation Files

1. **Application Service** (`src/applications/applications.service.ts`)
   - Creates outbox messages within the same database transaction as application creation
   - Creates messages for `document_uploaded` and `application_submitted` events
   - Uses Prisma's transaction functionality to ensure atomicity

2. **Outbox Relay Service** (`src/feature-flags/outbox/outbox-relay.service.ts`)
   - Fetches unprocessed outbox messages from the database
   - Processes messages based on event type
   - Enqueues jobs to appropriate BullMQ queues
   - Marks messages as processed after successful queue addition

3. **Outbox Relay Scheduler** (`src/feature-flags/outbox/outbox-relay.scheduler.ts`)
   - Runs at module initialization to process any pending messages
   - Executes every 2 seconds to continuously process new outbox messages
   - Uses `@Cron('*/2 * * * * *')` for frequent processing

4. **Feature Flags Module** (`src/feature-flags/feature-flags.module.ts`)
   - Includes outbox relay service and scheduler in the module
   - Exports the services for use throughout the application

5. **Feature Flag Seeder** (`src/feature-flags/feature-flags-seeder.service.ts`)
   - Creates the `outbox-pattern` feature flag with description: "Outbox Pattern: Transactional message publishing using outbox table"

### Database Schema
The Prisma schema includes an `outbox` model with:
- `id`: Unique identifier
- `eventType`: Type of event being published
- `payload`: JSON string containing message data
- `processedAt`: Timestamp when message was processed (null if pending)

### Architecture Flow

1. When creating an application in `applications.service.ts`:
   - Business logic executes within a database transaction
   - Multiple outbox messages may be created in the same transaction
   - Application and outbox messages are committed together

2. Outbox relay scheduler (`outbox-relay.scheduler.ts`):
   - Runs on module initialization and every 2 seconds
   - Calls `processOutbox()` method on the relay service

3. Outbox relay service (`outbox-relay.service.ts`):
   - Finds unprocessed messages (with `processedAt` = null)
   - Processes each message by adding jobs to appropriate queues
   - Marks messages as processed with `processedAt` timestamp
   - Handles errors gracefully to prevent system failure

### Benefits
- Ensures atomicity between business operations and message publishing
- Prevents lost messages if queue systems are temporarily unavailable
- Provides a reliable mechanism for asynchronous processing
- Maintains data consistency even in failure scenarios

## Metrics Comparison

For information about comparing metrics before and after applying these patterns, see:
- `docs/metrics-comparison-guide.md` - Complete guide for metrics comparison
- `metrics-analysis/metrics-comparison-report.md` - Detailed comparison report
- `metrics-analysis/` folder - Contains all scripts and data used for metrics comparison