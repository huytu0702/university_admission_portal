import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { Application } from '../../generated/prisma';

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  PROCESSING_PAYMENT = 'processing_payment',
  PAID = 'paid',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Injectable()
export class ApplicationStatusService {
  constructor(private prisma: PrismaService) {}

  async updateApplicationStatus(applicationId: string, status: ApplicationStatus, details?: string) {
    // Update the application status
    const updatedApplication = await this.prisma.application.update({
      where: { id: applicationId },
      data: { 
        status,
        updatedAt: new Date() // Update the timestamp as well
      },
    });

    // Optionally, log status changes for tracking purposes
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { 
        status: status,
        updatedAt: new Date()
      },
    });

    return updatedApplication;
  }

  async getApplicationStatus(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true, updatedAt: true }
    });

    return application;
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

    // Step 4: Application completed
    if (application.status === ApplicationStatus.COMPLETED) {
      progress += 1;
    }

    return Math.round((progress / totalSteps) * 100);
  }
}