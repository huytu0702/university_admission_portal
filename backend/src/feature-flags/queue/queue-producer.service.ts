import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

@Injectable()
export class QueueProducerService {
  constructor(
    @InjectQueue('verify_document') private verifyDocumentQueue: Queue,
    @InjectQueue('create_payment') private createPaymentQueue: Queue,
    @InjectQueue('send_email') private sendEmailQueue: Queue,
  ) {}

  async addVerifyDocumentJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    await this.verifyDocumentQueue.add('verify_document', data, {
      jobId,
      priority: this.mapPriority(priority),
    });
  }

  async addCreatePaymentJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    await this.createPaymentQueue.add('create_payment', data, {
      jobId,
      priority: this.mapPriority(priority),
    });
  }

  async addSendEmailJob(
    jobId: string, 
    data: any, 
    priority: JobPriority = 'normal'
  ): Promise<void> {
    await this.sendEmailQueue.add('send_email', data, {
      jobId,
      priority: this.mapPriority(priority),
    });
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