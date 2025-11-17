import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { FeatureFlagsService } from '../feature-flags.service';

export interface WorkerScalingConfig {
  queueName: string;
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: number; // Queue depth to trigger scale up
  scaleDownThreshold: number; // Queue depth to trigger scale down
  checkInterval: number; // Milliseconds between scaling checks
  cooldownPeriod: number; // Milliseconds to wait between scaling actions
}

export interface WorkerScalingMetrics {
  queueName: string;
  currentWorkers: number;
  queueDepth: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastScalingAction: string | null;
  lastScalingTime: Date | null;
}

@Injectable()
export class WorkerScalingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerScalingService.name);

  private scalingConfigs: Map<string, WorkerScalingConfig> = new Map();

  private currentWorkerCounts: Map<string, number> = new Map();

  private lastScalingTimes: Map<string, number> = new Map();

  private scalingInterval: NodeJS.Timeout | null = null;

  private isEnabled = false;

  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
    private featureFlagsService: FeatureFlagsService,
  ) {
    this.initializeConfigs();
  }

  async onModuleInit() {
    // Check if competing consumers pattern is enabled
    const flag = await this.featureFlagsService.getFlag('competing-consumers');
    this.isEnabled = flag?.enabled || false;

    if (this.isEnabled) {
      this.logger.log(
        'Dynamic Worker Scaling enabled. Starting scaling service...',
      );
      this.startScalingChecks();
    } else {
      this.logger.log('Dynamic Worker Scaling disabled.');
    }
  }

  onModuleDestroy() {
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
      this.logger.log('Worker scaling service stopped.');
    }
  }

  private initializeConfigs() {
    // Configuration for document verification workers
    this.scalingConfigs.set('verify_document', {
      queueName: 'verify_document',
      minWorkers: 2,
      maxWorkers: 10,
      scaleUpThreshold: 50, // Scale up when queue has >50 waiting jobs
      scaleDownThreshold: 10, // Scale down when queue has <10 waiting jobs
      checkInterval: 10000, // Check every 10 seconds
      cooldownPeriod: 30000, // Wait 30 seconds between scaling actions
    });

    // Configuration for payment processing workers
    this.scalingConfigs.set('create_payment', {
      queueName: 'create_payment',
      minWorkers: 3,
      maxWorkers: 15,
      scaleUpThreshold: 30,
      scaleDownThreshold: 5,
      checkInterval: 10000,
      cooldownPeriod: 20000, // Faster scaling for payment processing
    });

    // Configuration for email sending workers
    this.scalingConfigs.set('send_email', {
      queueName: 'send_email',
      minWorkers: 2,
      maxWorkers: 8,
      scaleUpThreshold: 100, // Emails can queue more before scaling
      scaleDownThreshold: 20,
      checkInterval: 15000,
      cooldownPeriod: 30000,
    });

    // Initialize current worker counts at minimum
    this.scalingConfigs.forEach((config, queueName) => {
      this.currentWorkerCounts.set(queueName, config.minWorkers);
    });
  }

  private startScalingChecks() {
    // Use the shortest check interval from all configs
    const checkInterval = Math.min(
      ...Array.from(this.scalingConfigs.values()).map((c) => c.checkInterval),
    );

    this.scalingInterval = setInterval(() => {
      void this.evaluateScaling();
    }, checkInterval);

    this.logger.log(
      `Worker scaling checks started (interval: ${checkInterval}ms)`,
    );
  }

  private async evaluateScaling() {
    for (const [queueName, config] of this.scalingConfigs.entries()) {
      try {
        const queue = this.getQueue(queueName);

        const waitingCount = await queue.getWaitingCount();
        const activeCount = await queue.getActiveCount();
        const currentWorkers =
          this.currentWorkerCounts.get(queueName) || config.minWorkers;

        // Check cooldown period
        const lastScaling = this.lastScalingTimes.get(queueName) || 0;
        const timeSinceLastScaling = Date.now() - lastScaling;

        if (timeSinceLastScaling < config.cooldownPeriod) {
          continue; // Skip this queue, still in cooldown
        }

        // Evaluate scaling decision
        if (
          waitingCount >= config.scaleUpThreshold &&
          currentWorkers < config.maxWorkers
        ) {
          // Scale up
          const newWorkerCount = Math.min(
            currentWorkers + 1,
            config.maxWorkers,
          );
          this.scaleWorkers(queueName, newWorkerCount);
          this.logger.log(
            `Scaled UP '${queueName}': ${currentWorkers} → ${newWorkerCount} workers ` +
              `(waiting: ${waitingCount}, threshold: ${config.scaleUpThreshold})`,
          );
        } else if (
          waitingCount <= config.scaleDownThreshold &&
          currentWorkers > config.minWorkers &&
          activeCount === 0
        ) {
          // Scale down (only if no active jobs)
          const newWorkerCount = Math.max(
            currentWorkers - 1,
            config.minWorkers,
          );
          this.scaleWorkers(queueName, newWorkerCount);
          this.logger.log(
            `Scaled DOWN '${queueName}': ${currentWorkers} → ${newWorkerCount} workers ` +
              `(waiting: ${waitingCount}, threshold: ${config.scaleDownThreshold})`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating scaling for '${queueName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private scaleWorkers(queueName: string, targetCount: number): void {
    this.currentWorkerCounts.set(queueName, targetCount);
    this.lastScalingTimes.set(queueName, Date.now());
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
   * Get current scaling metrics for a specific queue
   */
  async getScalingMetrics(
    queueName: string,
  ): Promise<WorkerScalingMetrics | null> {
    const config = this.scalingConfigs.get(queueName);
    if (!config) return null;

    const queue = this.getQueue(queueName);
    const currentWorkers =
      this.currentWorkerCounts.get(queueName) || config.minWorkers;
    const lastScalingTime = this.lastScalingTimes.get(queueName);

    const [waitingCount, activeCount, completedCount, failedCount] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

    return {
      queueName,
      currentWorkers,
      queueDepth: waitingCount + activeCount,
      waitingJobs: waitingCount,
      activeJobs: activeCount,
      completedJobs: completedCount,
      failedJobs: failedCount,
      lastScalingAction: lastScalingTime ? 'auto' : null,
      lastScalingTime: lastScalingTime ? new Date(lastScalingTime) : null,
    };
  }

  /**
   * Get scaling metrics for all queues
   */
  async getAllScalingMetrics(): Promise<WorkerScalingMetrics[]> {
    const metrics: WorkerScalingMetrics[] = [];
    for (const queueName of this.scalingConfigs.keys()) {
      const metric = await this.getScalingMetrics(queueName);
      if (metric) {
        metrics.push(metric);
      }
    }
    return metrics;
  }

  /**
   * Manually adjust worker count (bypasses auto-scaling)
   */
  setWorkerCount(queueName: string, count: number): void {
    const config = this.scalingConfigs.get(queueName);
    if (!config) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    if (count < config.minWorkers || count > config.maxWorkers) {
      throw new Error(
        `Worker count must be between ${config.minWorkers} and ${config.maxWorkers}`,
      );
    }

    this.scaleWorkers(queueName, count);
    this.logger.log(`Manually set worker count for '${queueName}' to ${count}`);
  }

  /**
   * Update scaling configuration
   */
  updateScalingConfig(
    queueName: string,
    updates: Partial<WorkerScalingConfig>,
  ): void {
    const currentConfig = this.scalingConfigs.get(queueName);
    if (!currentConfig) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    const newConfig = { ...currentConfig, ...updates };
    this.scalingConfigs.set(queueName, newConfig);
    this.logger.log(`Updated scaling config for '${queueName}'`, updates);
  }

  /**
   * Get current scaling configuration
   */
  getScalingConfig(queueName: string): WorkerScalingConfig | undefined {
    return this.scalingConfigs.get(queueName);
  }

  /**
   * Get all scaling configurations
   */
  getAllScalingConfigs(): Map<string, WorkerScalingConfig> {
    return new Map(this.scalingConfigs);
  }
}
