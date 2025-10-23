import { Injectable, Logger } from '@nestjs/common';
import type { Queue, Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
  ) {}

  async getFailedJobs(queueName: string): Promise<Job[]> {
    let queue: Queue;

    switch (queueName) {
      case 'verify_document':
        queue = this.verifyDocumentQueue;
        break;
      case 'create_payment':
        queue = this.createPaymentQueue;
        break;
      case 'send_email':
        queue = this.sendEmailQueue;
        break;
      default:
        throw new Error(`Unknown queue name: ${queueName}`);
    }

    return await queue.getFailed();
  }

  async requeueJob(queueName: string, jobId: string): Promise<boolean> {
    let queue: Queue;

    switch (queueName) {
      case 'verify_document':
        queue = this.verifyDocumentQueue;
        break;
      case 'create_payment':
        queue = this.createPaymentQueue;
        break;
      case 'send_email':
        queue = this.sendEmailQueue;
        break;
      default:
        throw new Error(`Unknown queue name: ${queueName}`);
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        this.logger.error(`Job ${jobId} not found in queue ${queueName}`);
        return false;
      }

      // Retry the failed job
      await job.retry();
      this.logger.log(`Successfully requeued job ${jobId} in queue ${queueName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to requeue job ${jobId} in queue ${queueName}: ${error.message}`);
      return false;
    }
  }

  async purgeFailedJobs(queueName: string): Promise<number> {
    let queue: Queue;

    switch (queueName) {
      case 'verify_document':
        queue = this.verifyDocumentQueue;
        break;
      case 'create_payment':
        queue = this.createPaymentQueue;
        break;
      case 'send_email':
        queue = this.sendEmailQueue;
        break;
      default:
        throw new Error(`Unknown queue name: ${queueName}`);
    }

    try {
      // Get all failed jobs
      const failedJobs = await queue.getFailed();
      
      // Remove each failed job
      for (const job of failedJobs) {
        await job.remove();
      }

      this.logger.log(`Purged ${failedJobs.length} failed jobs from queue ${queueName}`);
      return failedJobs.length;
    } catch (error) {
      this.logger.error(`Failed to purge jobs from queue ${queueName}: ${error.message}`);
      return 0;
    }
  }

  async getDlqMetrics(): Promise<{ [queueName: string]: number }> {
    const metrics = {};

    // Get failed job counts for each queue
    const verifyDocumentFailed = await this.verifyDocumentQueue.getFailed();
    const createPaymentFailed = await this.createPaymentQueue.getFailed();
    const sendEmailFailed = await this.sendEmailQueue.getFailed();

    metrics['verify_document'] = verifyDocumentFailed.length;
    metrics['create_payment'] = createPaymentFailed.length;
    metrics['send_email'] = sendEmailFailed.length;

    return metrics;
  }
}