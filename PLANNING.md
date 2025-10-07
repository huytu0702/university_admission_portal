# PLANNING.md — University Admission Portal (Before/After Design Patterns)

## 1) Vision

* Build a minimal **online admission portal** where applicants submit an application, are **redirected to payment immediately after submit**, and can track processing status. Admins can **toggle design patterns/quality attributes** to compare **Before (baseline)** vs **After (improved)** behavior. 
* Mandatory improvement: **Queue-Based Load Leveling**; optional flags: **Competing Consumers, Priority Queue, Cache-Aside, Idempotency, Retry + Backoff + DLQ, Circuit Breaker, Bulkhead, Outbox, CQRS-lite**. Target outcomes include **202 Accepted** for submit during bursts, linear throughput scaling with workers, lower transient errors, and clear status UX. 

## 2) Architecture (Baseline → After)

### 2.1 Baseline (Synchronous)

* Next.js → NestJS API (monolith) → PostgreSQL; single request does upload/verify, create payment, send email synchronously (higher latency under burst). 

### 2.2 After (Queued + Flags)

* **API path:** `POST /applications` writes **application + outbox** in a DB transaction → **Outbox Relay** enqueues jobs to **BullMQ/Redis**.
* **Workers:** Verify, Payment, Email (scalable pools, per-pool concurrency).
* **Client:** receives **202 Accepted** with `application_id`, `status_url`, `pay_url`; UI then **redirects to pay**; status polled via `GET /applications/{id}`.   
* **Data/Views:** core tables plus `outbox` and read-optimized `application_view` for CQRS-lite. 

**Key architectural properties to demo (Before vs After):**

* Submit latency: **p95 ~100–200ms (202 Accepted)** vs multi-second synchronous. 
* Throughput scales with worker count; retries/DLQ cut transient failures; priority queue enforces VIP SLAs; dashboards visualize metrics. 

## 3) Technology Stack

### 3.1 Frontend

* **Next.js 15** + **shadcn UI**; routes: `/`, `/login`, `/apply`, `/status/[id]`, `/admin`; status page polling (optionally SSE/WebSocket later).  

### 3.2 Backend

* **NestJS** (modular: auth, applications, payments-mock, health), **PostgreSQL** (transactions, schema + `outbox`, `application_view`). 
* **Redis + BullMQ** for queues (**verify_document**, **create_payment**, **send_email**). 

### 3.3 Patterns (Feature-flagged)

* **Required:** Queue-Based Load Leveling (BullMQ/Redis) with **202 Accepted** submit contract. 
* **Optional flags:** Competing Consumers, Priority Queue, Cache-Aside, Idempotency Key, Retry+Backoff+DLQ, Circuit Breaker (payment), Bulkhead, **Outbox**, **CQRS-lite**. 

### 3.4 Observability & Benchmarks

* Metrics: submit/status latency, queue depth & job age, throughput, retries/DLQ, cache hit/miss, circuit states, paid time; run **baseline → staged pattern enabling** and record a comparison table.  

## 4) Required Tools & Infrastructure

* **Runtime & Containers:** Docker Compose for Postgres, Redis, API, Web. (Project baseline infra implied by PRD scope) 
* **Database:** PostgreSQL + migration tooling. **Tables:** `applications`, `application_files`, `payments`, `outbox`; **View:** `application_view`. 
* **Queueing:** Redis + BullMQ; DLQ per queue; admin DLQ operations. 
* **Backend:** NestJS (REST, feature flags, DLQ console endpoints). 
* **Frontend:** Next.js 15 + shadcn; admin dashboard for toggles/metrics; status stepper and real-time feel (polling 1s).  
* **Observability:** OTEL traces, logs, latency/throughput dashboards; comparison views Before/After. (KPIs outlined in PRD)  
* **Testing/Load:** k6/Locust for spikes; scenario matrix: Baseline → Queue → +Idempotency → +Retry/DLQ → +Circuit/Bulkhead → +Priority → +Cache. 
* **Security & UX:** MIME/size validation, basic rate limiting; immediate **redirect to payment** after accepted submit.  

---

### Notes

* This plan is aligned tightly with the PRD’s narrowed scope, toggleable patterns, and benchmarking methodology to produce clear **Before/After** evidence. 
