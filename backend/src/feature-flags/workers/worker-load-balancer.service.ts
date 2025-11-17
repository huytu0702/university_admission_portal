import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round-robin',
  LEAST_CONNECTION = 'least-connection',
  WEIGHTED = 'weighted',
  HEALTH_BASED = 'health-based',
}

export interface WorkerNode {
  workerId: string;
  queueName: string;
  activeJobs: number;
  totalProcessed: number;
  failureCount: number;
  avgProcessingTime: number; // milliseconds
  lastHealthCheck: Date;
  healthy: boolean;
  weight: number; // For weighted load balancing
}

export interface LoadBalancingMetrics {
  strategy: LoadBalancingStrategy;
  totalJobsDistributed: number;
  distributionMap: Map<string, number>; // workerId -> job count
  avgDistributionVariance: number;
  lastBalancingTime: Date;
}

@Injectable()
export class WorkerLoadBalancerService {
  private readonly logger = new Logger(WorkerLoadBalancerService.name);

  private currentStrategy: LoadBalancingStrategy =
    LoadBalancingStrategy.ROUND_ROBIN;

  // Track worker nodes for each queue
  private workerNodes: Map<string, WorkerNode[]> = new Map();

  // Round-robin counters
  private roundRobinCounters: Map<string, number> = new Map();

  // Metrics tracking
  private metrics: Map<string, LoadBalancingMetrics> = new Map();

  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
  ) {
    this.initializeWorkerNodes();
  }

  private initializeWorkerNodes() {
    // Initialize worker nodes for document verification
    this.workerNodes.set('verify_document', [
      {
        workerId: 'verify_worker_1',
        queueName: 'verify_document',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
      {
        workerId: 'verify_worker_2',
        queueName: 'verify_document',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
      {
        workerId: 'verify_worker_3',
        queueName: 'verify_document',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
    ]);

    // Initialize worker nodes for payment processing
    this.workerNodes.set('create_payment', [
      {
        workerId: 'payment_worker_1',
        queueName: 'create_payment',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 2, // Higher weight for critical payment processing
      },
      {
        workerId: 'payment_worker_2',
        queueName: 'create_payment',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 2,
      },
      {
        workerId: 'payment_worker_3',
        queueName: 'create_payment',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
    ]);

    // Initialize worker nodes for email sending
    this.workerNodes.set('send_email', [
      {
        workerId: 'email_worker_1',
        queueName: 'send_email',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
      {
        workerId: 'email_worker_2',
        queueName: 'send_email',
        activeJobs: 0,
        totalProcessed: 0,
        failureCount: 0,
        avgProcessingTime: 0,
        lastHealthCheck: new Date(),
        healthy: true,
        weight: 1,
      },
    ]);

    // Initialize round-robin counters
    this.roundRobinCounters.set('verify_document', 0);
    this.roundRobinCounters.set('create_payment', 0);
    this.roundRobinCounters.set('send_email', 0);

    // Initialize metrics
    for (const queueName of this.workerNodes.keys()) {
      this.metrics.set(queueName, {
        strategy: this.currentStrategy,
        totalJobsDistributed: 0,
        distributionMap: new Map(),
        avgDistributionVariance: 0,
        lastBalancingTime: new Date(),
      });
    }

    this.logger.log('Worker load balancer initialized with worker nodes');
  }

  /**
   * Select the best worker for a job based on the current strategy
   */
  selectWorker(queueName: string, jobData?: any): WorkerNode | null {
    const workers = this.workerNodes.get(queueName);
    if (!workers || workers.length === 0) {
      this.logger.warn(`No workers available for queue '${queueName}'`);
      return null;
    }

    // Filter out unhealthy workers
    const healthyWorkers = workers.filter((w) => w.healthy);
    if (healthyWorkers.length === 0) {
      this.logger.warn(`No healthy workers available for queue '${queueName}'`);
      return null;
    }

    let selectedWorker: WorkerNode | null = null;

    switch (this.currentStrategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        selectedWorker = this.selectRoundRobin(queueName, healthyWorkers);
        break;

      case LoadBalancingStrategy.LEAST_CONNECTION:
        selectedWorker = this.selectLeastConnection(healthyWorkers);
        break;

      case LoadBalancingStrategy.WEIGHTED:
        selectedWorker = this.selectWeighted(healthyWorkers);
        break;

      case LoadBalancingStrategy.HEALTH_BASED:
        selectedWorker = this.selectHealthBased(healthyWorkers);
        break;

      default:
        selectedWorker = this.selectRoundRobin(queueName, healthyWorkers);
    }

    if (selectedWorker) {
      this.updateMetrics(queueName, selectedWorker.workerId);
    }

    return selectedWorker;
  }

  /**
   * Round-robin load balancing
   */
  private selectRoundRobin(
    queueName: string,
    workers: WorkerNode[],
  ): WorkerNode {
    const counter = this.roundRobinCounters.get(queueName) || 0;
    const selectedWorker = workers[counter % workers.length];

    // Update counter
    this.roundRobinCounters.set(queueName, counter + 1);

    return selectedWorker;
  }

  /**
   * Least connection load balancing
   * Select worker with fewest active jobs
   */
  private selectLeastConnection(workers: WorkerNode[]): WorkerNode {
    return workers.reduce((prev, current) =>
      current.activeJobs < prev.activeJobs ? current : prev,
    );
  }

  /**
   * Weighted load balancing
   * Workers with higher weight get more jobs
   */
  private selectWeighted(workers: WorkerNode[]): WorkerNode {
    const totalWeight = workers.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const worker of workers) {
      random -= worker.weight;
      if (random <= 0) {
        return worker;
      }
    }

    return workers[workers.length - 1]; // Fallback
  }

  /**
   * Health-based load balancing
   * Consider failure rate and processing time
   */
  private selectHealthBased(workers: WorkerNode[]): WorkerNode {
    // Calculate health score for each worker
    const scoredWorkers = workers.map((worker) => {
      const failureRate =
        worker.totalProcessed > 0
          ? worker.failureCount / worker.totalProcessed
          : 0;

      const processingTimeFactor =
        worker.avgProcessingTime > 0 ? 1 / worker.avgProcessingTime : 1;

      const loadFactor = 1 / (worker.activeJobs + 1);

      // Health score: higher is better
      const healthScore =
        (1 - failureRate) * 0.4 + processingTimeFactor * 0.3 + loadFactor * 0.3;

      return { worker, healthScore };
    });

    // Select worker with highest health score
    const best = scoredWorkers.reduce((prev, current) =>
      current.healthScore > prev.healthScore ? current : prev,
    );

    return best.worker;
  }

  /**
   * Update worker state when job starts
   */
  onJobStart(queueName: string, workerId: string, job: Job): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) return;

    const worker = workers.find((w) => w.workerId === workerId);
    if (worker) {
      worker.activeJobs++;
      this.logger.debug(
        `Job ${job.id} started on worker '${workerId}' (active: ${worker.activeJobs})`,
      );
    }
  }

  /**
   * Update worker state when job completes
   */
  onJobComplete(
    queueName: string,
    workerId: string,
    job: Job,
    processingTime: number,
  ): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) return;

    const worker = workers.find((w) => w.workerId === workerId);
    if (worker) {
      worker.activeJobs = Math.max(0, worker.activeJobs - 1);
      worker.totalProcessed++;

      // Update average processing time (exponential moving average)
      const alpha = 0.3; // Smoothing factor
      worker.avgProcessingTime =
        alpha * processingTime + (1 - alpha) * worker.avgProcessingTime;

      this.logger.debug(
        `Job ${job.id} completed on worker '${workerId}' in ${processingTime}ms`,
      );
    }
  }

  /**
   * Update worker state when job fails
   */
  onJobFail(queueName: string, workerId: string, job: Job, error: Error): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) return;

    const worker = workers.find((w) => w.workerId === workerId);
    if (worker) {
      worker.activeJobs = Math.max(0, worker.activeJobs - 1);
      worker.failureCount++;

      // Mark worker as unhealthy if failure rate is too high
      const failureRate =
        worker.totalProcessed > 0
          ? worker.failureCount / worker.totalProcessed
          : 0;

      if (failureRate > 0.5 && worker.totalProcessed > 10) {
        worker.healthy = false;
        this.logger.warn(
          `Worker '${workerId}' marked as unhealthy (failure rate: ${(failureRate * 100).toFixed(2)}%)`,
        );
      }

      this.logger.debug(
        `Job ${job.id} failed on worker '${workerId}': ${error.message}`,
      );
    }
  }

  /**
   * Update load balancing metrics
   */
  private updateMetrics(queueName: string, workerId: string): void {
    const metrics = this.metrics.get(queueName);
    if (!metrics) return;

    metrics.totalJobsDistributed++;
    const currentCount = metrics.distributionMap.get(workerId) || 0;
    metrics.distributionMap.set(workerId, currentCount + 1);
    metrics.lastBalancingTime = new Date();

    // Calculate distribution variance
    const counts = Array.from(metrics.distributionMap.values());
    if (counts.length > 1) {
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance =
        counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) /
        counts.length;
      metrics.avgDistributionVariance = Math.sqrt(variance);
    }
  }

  /**
   * Get load balancing metrics for a queue
   */
  getMetrics(queueName: string): LoadBalancingMetrics | undefined {
    return this.metrics.get(queueName);
  }

  /**
   * Get all load balancing metrics
   */
  getAllMetrics(): Map<string, LoadBalancingMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get worker nodes for a queue
   */
  getWorkerNodes(queueName: string): WorkerNode[] {
    return this.workerNodes.get(queueName) || [];
  }

  /**
   * Get all worker nodes
   */
  getAllWorkerNodes(): Map<string, WorkerNode[]> {
    return new Map(this.workerNodes);
  }

  /**
   * Change load balancing strategy
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.currentStrategy = strategy;
    this.logger.log(`Load balancing strategy changed to '${strategy}'`);

    // Update metrics
    for (const metrics of this.metrics.values()) {
      metrics.strategy = strategy;
    }
  }

  /**
   * Get current load balancing strategy
   */
  getStrategy(): LoadBalancingStrategy {
    return this.currentStrategy;
  }

  /**
   * Manually mark worker as healthy/unhealthy
   */
  setWorkerHealth(
    queueName: string,
    workerId: string,
    healthy: boolean,
  ): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const worker = workers.find((w) => w.workerId === workerId);
    if (!worker) {
      throw new Error(`Worker '${workerId}' not found in queue '${queueName}'`);
    }

    worker.healthy = healthy;
    this.logger.log(
      `Worker '${workerId}' manually set to ${healthy ? 'healthy' : 'unhealthy'}`,
    );
  }

  /**
   * Update worker weight (for weighted strategy)
   */
  setWorkerWeight(queueName: string, workerId: string, weight: number): void {
    if (weight < 0) {
      throw new Error('Weight must be non-negative');
    }

    const workers = this.workerNodes.get(queueName);
    if (!workers) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const worker = workers.find((w) => w.workerId === workerId);
    if (!worker) {
      throw new Error(`Worker '${workerId}' not found in queue '${queueName}'`);
    }

    worker.weight = weight;
    this.logger.log(`Worker '${workerId}' weight updated to ${weight}`);
  }

  /**
   * Reset metrics for a queue
   */
  resetMetrics(queueName: string): void {
    const metrics = this.metrics.get(queueName);
    if (metrics) {
      metrics.totalJobsDistributed = 0;
      metrics.distributionMap.clear();
      metrics.avgDistributionVariance = 0;
      metrics.lastBalancingTime = new Date();
      this.logger.log(`Metrics reset for queue '${queueName}'`);
    }
  }

  /**
   * Add a new worker node
   */
  addWorkerNode(queueName: string, workerId: string, weight = 1): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const exists = workers.find((w) => w.workerId === workerId);
    if (exists) {
      throw new Error(
        `Worker '${workerId}' already exists in queue '${queueName}'`,
      );
    }

    workers.push({
      workerId,
      queueName,
      activeJobs: 0,
      totalProcessed: 0,
      failureCount: 0,
      avgProcessingTime: 0,
      lastHealthCheck: new Date(),
      healthy: true,
      weight,
    });

    this.logger.log(`Added worker '${workerId}' to queue '${queueName}'`);
  }

  /**
   * Remove a worker node
   */
  removeWorkerNode(queueName: string, workerId: string): void {
    const workers = this.workerNodes.get(queueName);
    if (!workers) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    const index = workers.findIndex((w) => w.workerId === workerId);
    if (index === -1) {
      throw new Error(`Worker '${workerId}' not found in queue '${queueName}'`);
    }

    const worker = workers[index];
    if (worker.activeJobs > 0) {
      throw new Error(
        `Cannot remove worker '${workerId}' with ${worker.activeJobs} active jobs`,
      );
    }

    workers.splice(index, 1);
    this.logger.log(`Removed worker '${workerId}' from queue '${queueName}'`);
  }
}
