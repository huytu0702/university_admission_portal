import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Job } from 'bull';

export interface JobData {
  applicationId: string;
  [key: string]: any;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number;  // in milliseconds
}

@Injectable()
export abstract class WorkerBase {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected prisma: PrismaService) {}

  abstract processJob(jobData: JobData): Promise<any>;

  async processJobWithRetry(jobData: JobData, job: Job): Promise<any> {
    const attemptNumber = job.attemptsMade + 1;
    
    try {
      const result = await this.processJob(jobData);
      this.logger.log(`Job ${job.id} completed successfully on attempt ${attemptNumber}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed on attempt ${attemptNumber} of ${job.opts.attempts || 1}: ${error.message}`,
        error.stack
      );
      
      // Re-throw the error to trigger Bull's retry mechanism
      throw error;
    }
  }

  async updateApplicationStatus(applicationId: string, status: string) {
    // In a real implementation, you would calculate progress based on the 
    // current state of the application and what step is being completed
    let progress = 0;
    
    switch (status) {
      case 'submitted':
        progress = 25;
        break;
      case 'verifying':
        progress = 30; // Between submitted and verified
        break;
      case 'verified':
        progress = 50;
        break;
      case 'verification_failed':
        progress = 25; // Status failed at verification step
        break;
      case 'processing_payment':
        progress = 55; // Between verified and payment
        break;
      case 'payment_initiated':
        progress = 75;
        break;
      case 'payment_failed':
        progress = 50; // Status failed at payment step
        break;
      case 'completed':
        progress = 100;
        break;
      default:
        // Could derive progress from status in other ways
        break;
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status, progress },
    });
  }
}