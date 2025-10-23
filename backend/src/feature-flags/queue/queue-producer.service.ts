import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { BulkheadService } from '../bulkhead/bulkhead.service';
import { FeatureFlagsService } from '../feature-flags.service';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

@Injectable()
export class QueueProducerService {
  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
    private bulkheadService: BulkheadService,
    private featureFlagsService: FeatureFlagsService,
  ) {}

  async addVerifyDocumentJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    // Check if bulkhead isolation is enabled
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    if (flag && flag.enabled) {
      // Execute with bulkhead isolation
      await this.bulkheadService.executeInBulkhead('verify_document', async () => {
        await this.verifyDocumentQueue.add('verify_document', data, {
          jobId,
          priority: this.mapPriority(priority),
          // Add retry configuration if retry feature is enabled
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      });
    } else {
      // Execute without bulkhead isolation
      await this.verifyDocumentQueue.add('verify_document', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  async addCreatePaymentJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    // Check if bulkhead isolation is enabled
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    if (flag && flag.enabled) {
      // Execute with bulkhead isolation
      await this.bulkheadService.executeInBulkhead('create_payment', async () => {
        await this.createPaymentQueue.add('create_payment', data, {
          jobId,
          priority: this.mapPriority(priority),
          // Add retry configuration if retry feature is enabled
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });
      });
    } else {
      // Execute without bulkhead isolation
      await this.createPaymentQueue.add('create_payment', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  async addSendEmailJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    // Check if bulkhead isolation is enabled
    const flag = await this.featureFlagsService.getFlag('bulkhead-isolation');
    if (flag && flag.enabled) {
      // Execute with bulkhead isolation
      await this.bulkheadService.executeInBulkhead('send_email', async () => {
        await this.sendEmailQueue.add('send_email', data, {
          jobId,
          priority: this.mapPriority(priority),
          // Add retry configuration if retry is enabled
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });
      });
    } else {
      // Execute without bulkhead isolation
      await this.sendEmailQueue.add('send_email', data, {
        jobId,
        priority: this.mapPriority(priority),
      });
    }
  }

  private mapPriority(priority: JobPriority): number {
    switch (priority) {
      case 'low': return 3;
      case 'normal': return 2;
      case 'high': return 1;
      case 'critical': return 0;
      default: return 2;
    }
  }
}