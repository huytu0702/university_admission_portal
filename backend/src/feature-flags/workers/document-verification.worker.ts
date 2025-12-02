import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { WorkerBase } from './worker-base';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentVerificationService } from '../../documents/document-verification.service';
import { Inject, Logger, Injectable } from '@nestjs/common';

export interface VerifyDocumentJobData {
  applicationId: string;
  applicationFileIds: string[];
}

@Processor('verify_document')
export class DocumentVerificationWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private documentVerificationService: DocumentVerificationService,
  ) {
    super(prisma);
  }

  async processJob(jobData: VerifyDocumentJobData): Promise<any> {
    const { applicationId, applicationFileIds } = jobData;

    // Update application status to 'verifying'
    await this.updateApplicationStatus(applicationId, 'verifying');

    try {
      // Process each file for verification
      for (const filePath of applicationFileIds) {
        // Find the application files by their path (there might be multiple files with the same path)
        const applicationFiles = await this.prisma.applicationFile.findMany({
          where: { 
            applicationId,
            filePath 
          },
        });

        if (applicationFiles.length > 0) {
          for (const applicationFile of applicationFiles) {
            // Verify the document
            await this.documentVerificationService.verifyDocument(applicationFile.id);
          }
        } else {
          this.logger.warn(`No application files found with path ${filePath} for application ${applicationId}`);
        }
      }

      // Update application status to 'verified' after all files are processed
      await this.updateApplicationStatus(applicationId, 'verified');

      // Emit event to trigger next job (payment)
      // This event will be picked up by OutboxRelayScheduler
      await this.prisma.outbox.create({
        data: {
          eventType: 'document_verified',
          payload: JSON.stringify({
            applicationId: applicationId,
          }),
        },
      });
      this.logger.log(`Emitted document_verified event for app: ${applicationId}`);

      return { success: true, applicationId };
    } catch (error) {
      // Update application status to 'verification_failed'
      await this.updateApplicationStatus(applicationId, 'verification_failed');
      this.logger.error(`Document verification failed for application ${applicationId}: ${error.message}`);
      throw error;
    }
  }

  @Process('verify_document')
  async processVerifyDocument(job: Job<VerifyDocumentJobData>): Promise<any> {
    return await this.processJobWithRetry(job.data, job);
  }
}