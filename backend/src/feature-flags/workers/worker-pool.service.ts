import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { FeatureFlagsService } from '../feature-flags.service';

export interface WorkerPoolDefinition {
  poolId: string;
  poolName: string;
  queueName: string;
  description: string;
  concurrency: number; // Jobs per worker instance
  priority: number; // Pool priority (lower = higher priority)
  enabled: boolean;
}

export interface WorkerPoolStats {
  poolId: string;
  poolName: string;
  queueName: string;
  enabled: boolean;
  concurrency: number;

  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;

  throughput: number; // Jobs completed in last minute
  avgProcessingTime: number; // Average time in milliseconds
  errorRate: number;
  lastJobCompletedAt: Date | null;
  lastJobFailedAt: Date | null;
}

export interface WorkerPoolHealth {
  poolId: string;
  healthy: boolean;
  status: 'active' | 'degraded' | 'critical' | 'paused';
  issues: string[];
  lastCheckAt: Date;
}

@Injectable()
export class WorkerPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerPoolService.name);

  private pools: Map<string, WorkerPoolDefinition> = new Map();

  private poolStats: Map<string, WorkerPoolStats> = new Map();

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private isEnabled = false;

  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async onModuleInit() {
    // Check if competing consumers pattern is enabled
    const flag = await this.featureFlagsService.getFlag('competing-consumers');
    this.isEnabled = flag?.enabled || false;
    if (this.isEnabled) {
      this.logger.log('Worker Pool Management enabled. Initializing pools...');
      this.initializePools();
      this.startHealthMonitoring();
    } else {
      this.logger.log('Worker Pool Management disabled.');
    }
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.logger.log('Worker pool health monitoring stopped.');
    }
  }

  private initializePools() {
    // Register document verification pool
    this.registerPool({
      poolId: 'pool_verify_document',
      poolName: 'Document Verification',
      queueName: 'verify_document',
      description: 'Processes document verification tasks for applications',
      concurrency: 3,
      priority: 1, // High priority
      enabled: true,
    });

    // Register payment processing pool
    this.registerPool({
      poolId: 'pool_create_payment',
      poolName: 'Payment Processing',
      queueName: 'create_payment',
      description: 'Handles payment creation and processing',
      concurrency: 5,
      priority: 0, // Highest priority (payments are critical)
      enabled: true,
    });

    // Register email sending pool
    this.registerPool({
      poolId: 'pool_send_email',
      poolName: 'Email Notifications',
      queueName: 'send_email',
      description: 'Sends email notifications to users',
      concurrency: 10,
      priority: 2, // Lower priority (can be delayed)
      enabled: true,
    });

    this.logger.log(`Initialized ${this.pools.size} worker pools`);
  }

  private registerPool(definition: WorkerPoolDefinition): void {
    this.pools.set(definition.poolId, definition);

    this.poolStats.set(definition.poolId, {
      poolId: definition.poolId,
      poolName: definition.poolName,
      queueName: definition.queueName,
      enabled: definition.enabled,
      concurrency: definition.concurrency,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
      throughput: 0,
      avgProcessingTime: 0,
      errorRate: 0,
      lastJobCompletedAt: null,
      lastJobFailedAt: null,
    });

    this.logger.log(
      `Registered pool '${definition.poolName}' (${definition.poolId})  with concurrency ${definition.concurrency}`,
    );
  }

  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      void this.updateAllPoolStats();
    }, this.HEALTH_CHECK_INTERVAL);

    this.logger.log(
      `Health monitoring started (interval: ${this.HEALTH_CHECK_INTERVAL}ms)`,
    );
  }

  private async updateAllPoolStats(): Promise<void> {
    for (const [poolId, definition] of this.pools.entries()) {
      try {
        await this.updatePoolStats(poolId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to update stats for pool '${definition.poolName}': ${message}`,
        );
      }
    }
  }

  private async updatePoolStats(poolId: string): Promise<void> {
    const definition = this.pools.get(poolId);
    if (!definition) return;

    const queue = this.getQueue(definition.queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Get recent completed jobs for metrics
    const recentJobs = await queue.getCompleted(0, 99);
    const oneMinuteAgo = Date.now() - 60000;

    const recentCompletedJobs = recentJobs.filter(
      (job: Job) => job.finishedOn && job.finishedOn > oneMinuteAgo,
    );

    // Calculate throughput (jobs/minute)
    const throughput = recentCompletedJobs.length;

    // Calculate average processing time
    let avgProcessingTime = 0;
    if (recentCompletedJobs.length > 0) {
      const totalTime = recentCompletedJobs.reduce(
        (sum: number, job: Job) => sum + (job.finishedOn! - job.processedOn!),
        0,
      );
      avgProcessingTime = totalTime / recentCompletedJobs.length;
    }

    // Calculate error rate
    const totalRecent = recentCompletedJobs.length + failed;
    const errorRate = totalRecent > 0 ? (failed / totalRecent) * 100 : 0;

    // Get last job timestamps
    let lastJobCompletedAt: Date | null = null;
    let lastJobFailedAt: Date | null = null;

    if (recentCompletedJobs.length > 0) {
      const lastCompleted = recentCompletedJobs[0];
      lastJobCompletedAt = lastCompleted.finishedOn
        ? new Date(lastCompleted.finishedOn)
        : null;
    }

    const failedJobs = await queue.getFailed(0, 0);
    if (failedJobs.length > 0) {
      const lastFailed = failedJobs[0];
      lastJobFailedAt = lastFailed.failedReason
        ? new Date(lastFailed.finishedOn!)
        : null;
    }

    // Update stats
    this.poolStats.set(poolId, {
      poolId,
      poolName: definition.poolName,
      queueName: definition.queueName,
      enabled: definition.enabled,
      concurrency: definition.concurrency,
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: await queue.isPaused(),
      throughput,
      avgProcessingTime: Math.round(avgProcessingTime),
      errorRate: Math.round(errorRate * 100) / 100,
      lastJobCompletedAt,
      lastJobFailedAt,
    });
  }

  private getQueue(queueName: string): Queue {
    switch (queueName) {
      case 'verify_document':
        return this.verifyDocumentQueue;
      case 'create_payment':
        return this.createPaymentQueue;
      case 'send_email':
        return this.sendEmailQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  /**
   * Get definition of a specific pool
   */
  getPoolDefinition(poolId: string): WorkerPoolDefinition | undefined {
    return this.pools.get(poolId);
  }

  /**
   * Get all pool definitions
   */
  getAllPoolDefinitions(): WorkerPoolDefinition[] {
    return Array.from(this.pools.values());
  }

  /**
   * Get statistics for a specific pool
   */
  async getPoolStats(poolId: string): Promise<WorkerPoolStats | undefined> {
    await this.updatePoolStats(poolId);
    return this.poolStats.get(poolId);
  }

  /**
   * Get statistics for all pools
   */
  async getAllPoolStats(): Promise<WorkerPoolStats[]> {
    await this.updateAllPoolStats();
    return Array.from(this.poolStats.values());
  }

  /**
   * Get health status of a specific pool
   */
  async getPoolHealth(poolId: string): Promise<WorkerPoolHealth | null> {
    const stats = await this.getPoolStats(poolId);
    if (!stats) return null;

    const issues: string[] = [];
    let status: 'active' | 'degraded' | 'critical' | 'paused' = 'active';

    // Check if paused
    if (stats.paused) {
      status = 'paused';
      issues.push('Pool is paused');
    }

    // Check error rate
    if (stats.errorRate > 50) {
      status = 'critical';
      issues.push(`High error rate: ${stats.errorRate}%`);
    } else if (stats.errorRate > 20) {
      status = status === 'active' ? 'degraded' : status;
      issues.push(`Elevated error rate: ${stats.errorRate}%`);
    }

    // Check queue depth
    if (stats.waiting > 1000) {
      status = 'critical';
      issues.push(`Critical queue depth: ${stats.waiting} jobs waiting`);
    } else if (stats.waiting > 500) {
      status = status === 'active' ? 'degraded' : status;
      issues.push(`High queue depth: ${stats.waiting} jobs waiting`);
    }

    // Check for stalled jobs
    if (stats.active > 0 && stats.throughput === 0) {
      status = status === 'active' ? 'degraded' : status;
      issues.push('Possible stalled jobs detected');
    }

    return {
      poolId,
      healthy: status === 'active',
      status,
      issues,
      lastCheckAt: new Date(),
    };
  }

  /**
   * Get health status for all pools
   */
  async getAllPoolHealth(): Promise<WorkerPoolHealth[]> {
    const healthStatuses: WorkerPoolHealth[] = [];

    for (const poolId of this.pools.keys()) {
      const health = await this.getPoolHealth(poolId);
      if (health) {
        healthStatuses.push(health);
      }
    }
    return healthStatuses;
  }

  /**
   * Update pool configuration
   */
  updatePoolConfig(
    poolId: string,
    updates: Partial<WorkerPoolDefinition>,
  ): WorkerPoolDefinition {
    const current = this.pools.get(poolId);
    if (!current) {
      throw new Error(`Pool '${poolId}' not found`);
    }

    const updated = { ...current, ...updates };
    this.pools.set(poolId, updated);
    this.logger.log(
      `Updated configuration for pool '${updated.poolName}'`,
      updates,
    );
    return updated;
  }

  /**
   * Enable or disable a pool
   */
  async setPoolEnabled(poolId: string, enabled: boolean): Promise<void> {
    const definition = this.pools.get(poolId);
    if (!definition) {
      throw new Error(`Pool '${poolId}' not found`);
    }

    const updated = this.updatePoolConfig(poolId, { enabled });
    const queue = this.getQueue(updated.queueName);
    if (enabled) {
      await queue.resume();
      this.logger.log(`Pool '${updated.poolName}' enabled and resumed`);
    } else {
      await queue.pause();
      this.logger.log(`Pool '${updated.poolName}' disabled and paused`);
    }
  }

  /**
   * Pause a pool (temporarily stop processing)
   */
  async pausePool(poolId: string): Promise<void> {
    const definition = this.pools.get(poolId);
    if (!definition) {
      throw new Error(`Pool '${poolId}' not found`);
    }

    const queue = this.getQueue(definition.queueName);
    await queue.pause();
    this.logger.log(`Pool '${definition.poolName}' paused`);
  }

  /**
   * Resume a paused pool
   */
  async resumePool(poolId: string): Promise<void> {
    const definition = this.pools.get(poolId);
    if (!definition) {
      throw new Error(`Pool '${poolId}' not found`);
    }

    const queue = this.getQueue(definition.queueName);
    await queue.resume();
    this.logger.log(`Pool '${definition.poolName}' resumed`);
  }

  /**
   * Clean completed jobs from a pool
   */
  async cleanPool(poolId: string, grace: number = 3600000): Promise<number> {
    const definition = this.pools.get(poolId);
    if (!definition) {
      throw new Error(`Pool '${poolId}' not found`);
    }

    const queue = this.getQueue(definition.queueName);
    const jobs = await queue.clean(grace, 'completed');
    this.logger.log(
      `Cleaned ${jobs.length} completed jobs from pool '${definition.poolName}'`,
    );
    return jobs.length;
  }

  /**
   * Get pool by queue name
   */
  getPoolByQueueName(queueName: string): WorkerPoolDefinition | undefined {
    return Array.from(this.pools.values()).find(
      (pool) => pool.queueName === queueName,
    );
  }
}
