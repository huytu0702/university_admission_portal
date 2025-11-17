/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP Metrics
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestTotal: Counter;
  public readonly httpRequestErrors: Counter;

  // Application Metrics
  public readonly applicationSubmissions: Counter;
  public readonly applicationProcessingDuration: Histogram;
  public readonly applicationStatus: Gauge;

  // Queue Metrics
  public readonly queueJobsEnqueued: Counter;
  public readonly queueJobsProcessed: Counter;
  public readonly queueJobsFailed: Counter;
  public readonly queueJobDuration: Histogram;
  public readonly queueDepth: Gauge;
  public readonly queueWorkerCount: Gauge;

  // Pattern-Specific Metrics
  public readonly patternEnabled: Gauge;
  public readonly retryAttempts: Counter;
  public readonly circuitBreakerState: Gauge;
  public readonly cacheHits: Counter;
  public readonly cacheMisses: Counter;
  public readonly outboxProcessed: Counter;

  // Payment Metrics
  public readonly paymentInitiations: Counter;
  public readonly paymentSuccesses: Counter;
  public readonly paymentFailures: Counter;
  public readonly paymentDuration: Histogram;

  // Email Metrics
  public readonly emailsSent: Counter;
  public readonly emailsFailed: Counter;
  public readonly emailDuration: Histogram;

  // Document Verification Metrics
  public readonly documentsVerified: Counter;
  public readonly documentVerificationFailed: Counter;
  public readonly documentVerificationDuration: Histogram;

  // Worker Pool Metrics
  public readonly workerPoolUtilization: Gauge;
  public readonly workerPoolThroughput: Counter;
  public readonly workerPoolErrors: Counter;

  constructor() {
    this.registry = new Registry();

    // HTTP Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [this.registry],
    });

    // Application Metrics
    this.applicationSubmissions = new Counter({
      name: 'application_submissions_total',
      help: 'Total number of application submissions',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.applicationProcessingDuration = new Histogram({
      name: 'application_processing_duration_seconds',
      help: 'Duration of application processing in seconds',
      labelNames: ['stage'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
      registers: [this.registry],
    });

    this.applicationStatus = new Gauge({
      name: 'application_status_count',
      help: 'Number of applications by status',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // Queue Metrics
    this.queueJobsEnqueued = new Counter({
      name: 'queue_jobs_enqueued_total',
      help: 'Total number of jobs enqueued',
      labelNames: ['queue_name', 'job_type'],
      registers: [this.registry],
    });

    this.queueJobsProcessed = new Counter({
      name: 'queue_jobs_processed_total',
      help: 'Total number of jobs processed successfully',
      labelNames: ['queue_name', 'job_type'],
      registers: [this.registry],
    });

    this.queueJobsFailed = new Counter({
      name: 'queue_jobs_failed_total',
      help: 'Total number of jobs failed',
      labelNames: ['queue_name', 'job_type', 'error_type'],
      registers: [this.registry],
    });

    this.queueJobDuration = new Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue_name', 'job_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'queue_depth',
      help: 'Current number of jobs waiting in queue',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    this.queueWorkerCount = new Gauge({
      name: 'queue_worker_count',
      help: 'Current number of active workers',
      labelNames: ['queue_name'],
      registers: [this.registry],
    });

    // Pattern-Specific Metrics
    this.patternEnabled = new Gauge({
      name: 'pattern_enabled',
      help: 'Whether a design pattern is enabled (1) or disabled (0)',
      labelNames: ['pattern_name'],
      registers: [this.registry],
    });

    this.retryAttempts = new Counter({
      name: 'retry_attempts_total',
      help: 'Total number of retry attempts',
      labelNames: ['job_type', 'attempt_number'],
      registers: [this.registry],
    });

    this.circuitBreakerState = new Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key_pattern'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key_pattern'],
      registers: [this.registry],
    });

    this.outboxProcessed = new Counter({
      name: 'outbox_messages_processed_total',
      help: 'Total number of outbox messages processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    // Payment Metrics
    this.paymentInitiations = new Counter({
      name: 'payment_initiations_total',
      help: 'Total number of payment initiations',
      registers: [this.registry],
    });

    this.paymentSuccesses = new Counter({
      name: 'payment_successes_total',
      help: 'Total number of successful payments',
      registers: [this.registry],
    });

    this.paymentFailures = new Counter({
      name: 'payment_failures_total',
      help: 'Total number of failed payments',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.paymentDuration = new Histogram({
      name: 'payment_duration_seconds',
      help: 'Duration of payment processing in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Email Metrics
    this.emailsSent = new Counter({
      name: 'emails_sent_total',
      help: 'Total number of emails sent successfully',
      labelNames: ['email_type'],
      registers: [this.registry],
    });

    this.emailsFailed = new Counter({
      name: 'emails_failed_total',
      help: 'Total number of failed email sends',
      labelNames: ['email_type', 'error_type'],
      registers: [this.registry],
    });

    this.emailDuration = new Histogram({
      name: 'email_duration_seconds',
      help: 'Duration of email sending in seconds',
      labelNames: ['email_type'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Document Verification Metrics
    this.documentsVerified = new Counter({
      name: 'documents_verified_total',
      help: 'Total number of documents verified',
      labelNames: ['verification_result'],
      registers: [this.registry],
    });

    this.documentVerificationFailed = new Counter({
      name: 'document_verification_failed_total',
      help: 'Total number of document verification failures',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.documentVerificationDuration = new Histogram({
      name: 'document_verification_duration_seconds',
      help: 'Duration of document verification in seconds',
      buckets: [0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    // Worker Pool Metrics
    this.workerPoolUtilization = new Gauge({
      name: 'worker_pool_utilization',
      help: 'Worker pool utilization percentage',
      labelNames: ['pool_id', 'pool_name'],
      registers: [this.registry],
    });

    this.workerPoolThroughput = new Counter({
      name: 'worker_pool_throughput_total',
      help: 'Total jobs processed by worker pool',
      labelNames: ['pool_id', 'pool_name'],
      registers: [this.registry],
    });

    this.workerPoolErrors = new Counter({
      name: 'worker_pool_errors_total',
      help: 'Total errors in worker pool',
      labelNames: ['pool_id', 'pool_name', 'error_type'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (CPU, memory, event loop, etc.)
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });
  }

  /**
   * Get metrics in Prometheus format
   */
  getMetrics(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.registry.metrics();
  }

  /**
   * Get registry for custom use
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.registry.resetMetrics();
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    status: number,
    duration: number,
  ): void {
    this.httpRequestTotal.inc({ method, route, status: status.toString() });
    this.httpRequestDuration.observe(
      { method, route, status: status.toString() },
      duration,
    );
  }

  /**
   * Record HTTP request error
   */
  recordHttpError(method: string, route: string, errorType: string): void {
    this.httpRequestErrors.inc({ method, route, error_type: errorType });
  }

  /**
   * Update pattern enabled status
   */
  setPatternEnabled(patternName: string, enabled: boolean): void {
    this.patternEnabled.set({ pattern_name: patternName }, enabled ? 1 : 0);
  }

  /**
   * Update queue depth metric
   */
  setQueueDepth(queueName: string, depth: number): void {
    this.queueDepth.set({ queue_name: queueName }, depth);
  }

  /**
   * Update worker count metric
   */
  setWorkerCount(queueName: string, count: number): void {
    this.queueWorkerCount.set({ queue_name: queueName }, count);
  }

  /**
   * Update circuit breaker state
   * @param service Service name
   * @param state 0=closed, 1=open, 2=half-open
   */
  setCircuitBreakerState(service: string, state: 0 | 1 | 2): void {
    this.circuitBreakerState.set({ service }, state);
  }

  /**
   * Update application status counts
   */
  setApplicationStatusCount(status: string, count: number): void {
    this.applicationStatus.set({ status }, count);
  }

  /**
   * Update worker pool utilization
   */
  setWorkerPoolUtilization(
    poolId: string,
    poolName: string,
    utilization: number,
  ): void {
    this.workerPoolUtilization.set(
      { pool_id: poolId, pool_name: poolName },
      utilization,
    );
  }
}
