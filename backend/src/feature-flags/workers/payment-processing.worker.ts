import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { WorkerBase } from './worker-base';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../../payments-mock/payment.service';
import { Inject, Logger } from '@nestjs/common';

export interface CreatePaymentJobData {
  applicationId: string;
}

@Processor('create_payment')
export class PaymentProcessingWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private paymentService: PaymentService,
  ) {
    super(prisma);
  }

  async processJob(jobData: CreatePaymentJobData): Promise<any> {
    const { applicationId } = jobData;

    // Update application status to 'processing_payment'
    await this.updateApplicationStatus(applicationId, 'processing_payment');

    try {
      // Create a payment for the application
      await this.paymentService.createPaymentIntent({
        applicationId,
        amount: 7500, // $75.00 in cents - example application fee
        currency: 'usd',
      });

      // Update application status to 'payment_initiated'
      await this.updateApplicationStatus(applicationId, 'payment_initiated');

      return { success: true, applicationId };
    } catch (error) {
      // Update application status to 'payment_failed'
      await this.updateApplicationStatus(applicationId, 'payment_failed');
      this.logger.error(`Payment processing failed for application ${applicationId}: ${error.message}`);
      throw error;
    }
  }

  @Process('create_payment')
  async processCreatePayment(job: Job<CreatePaymentJobData>): Promise<any> {
    return this.processJobWithRetry(job.data, job);
  }
}