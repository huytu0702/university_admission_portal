import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { Application } from '../../generated/prisma';
import { EmailService } from '../email/email.service';
import { QueueProducerService } from '../feature-flags/queue/queue-producer.service';

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  VERIFICATION_FAILED = 'verification_failed',
  PROCESSING_PAYMENT = 'processing_payment',
  PAYMENT_FAILED = 'payment_failed',
  PAID = 'paid',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Injectable()
export class ApplicationStatusService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private queueProducerService: QueueProducerService,
  ) {}

  async updateApplicationStatus(applicationId: string, status: ApplicationStatus, details?: string) {
    // Get the application and user before updating status to get the email
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: true
      }
    });

    if (!application) {
      throw new Error(`Application with ID ${applicationId} not found`);
    }

    // Update the application status
    let updatedApplication = await this.prisma.application.update({
      where: { id: applicationId },
      data: { 
        status,
        updatedAt: new Date() // Update the timestamp as well
      },
    });

    // Enqueue status update email to queue
    try {
      if (application.user.email) {
        await this.queueProducerService.addSendEmailJob(
          `email-status-${applicationId}`,
          {
            applicationId,
            email: application.user.email,
            template: 'status-update'
          }
        );
      }
    } catch (error) {
      console.error('Failed to enqueue status update email:', error);
      // Don't fail the status update if email enqueuing fails
    }

    // If the status is COMPLETED, update the progress to 100%
    if (status === ApplicationStatus.COMPLETED) {
      updatedApplication = await this.prisma.application.update({
        where: { id: applicationId },
        data: { 
          progress: 100,
          updatedAt: new Date()
        },
      });
    }

    return updatedApplication;
  }

  async markApplicationAsComplete(applicationId: string) {
    // Get the application and user before updating status to get the email
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        user: true
      }
    });

    if (!application) {
      throw new Error(`Application with ID ${applicationId} not found`);
    }

    // Update the application status to completed and set progress to 100%
    const updatedApplication = await this.prisma.application.update({
      where: { id: applicationId },
      data: { 
        status: ApplicationStatus.COMPLETED,
        progress: 100, // 100% progress when completed
        updatedAt: new Date()
      },
    });

    // Enqueue completion status update email to queue
    try {
      if (application.user.email) {
        await this.queueProducerService.addSendEmailJob(
          `email-completion-${applicationId}`,
          {
            applicationId,
            email: application.user.email,
            template: 'status-update'
          }
        );
      }
    } catch (error) {
      console.error('Failed to enqueue completion status email:', error);
      // Don't fail the completion if email enqueuing fails
    }

    return updatedApplication;
  }

  async getApplicationStatus(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { 
        id: true,
        status: true, 
        progress: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!application) {
      return null;
    }

    return {
      id: application.id,
      status: application.status,
      progress: application.progress,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  async getAllApplicationStatuses(userId: string) {
    return await this.prisma.application.findMany({
      where: { userId },
      select: { 
        id: true, 
        status: true, 
        createdAt: true, 
        updatedAt: true 
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async calculateProgressPercentage(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicationFiles: true,
        payment: true,
      }
    });

    if (!application) {
      return 0;
    }

    // If the application is completed, return 100% progress
    if (application.status === ApplicationStatus.COMPLETED) {
      return 100;
    }

    // Otherwise, calculate progress based on steps completed
    let progress = 0;
    const totalSteps = 4; // submitted, document verification, payment, completion

    // Step 1: Application submitted
    if (application.status !== ApplicationStatus.SUBMITTED) {
      progress += 1;
    }

    // Step 2: Documents verified
    if (application.applicationFiles && application.applicationFiles.length > 0) {
      const allVerified = application.applicationFiles.every(file => file.verified);
      if (allVerified) {
        progress += 1;
      }
    }

    // Step 3: Payment processed
    if (application.payment && application.payment.status === 'succeeded') {
      progress += 1;
    }

    // Step 4: Application completed - would be handled above
    return Math.round((progress / totalSteps) * 100);
  }
}