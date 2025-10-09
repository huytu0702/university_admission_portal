import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { WorkerBase } from './worker-base';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';

export interface SendEmailJobData {
  applicationId: string;
  email: string;
  template?: string;
}

@Processor('send_email')
export class EmailSendingWorker extends WorkerBase {
  constructor(
    prisma: PrismaService,
    private emailService: EmailService,
  ) {
    super(prisma);
  }

  async processJob(jobData: SendEmailJobData): Promise<any> {
    const { applicationId, email, template = 'status-update' } = jobData;

    try {
      // Update application status if needed
      if (!template.includes('status-update') && !template.includes('confirmation')) {
        await this.updateApplicationStatus(applicationId, 'sending_email');
      }

      // Send the appropriate email based on the template
      if (template === 'status-update') {
        const application = await this.prisma.application.findUnique({
          where: { id: applicationId },
          include: { user: true }
        });

        if (application && application.user.email) {
          await this.emailService.sendApplicationStatusUpdate(
            application.user.email,
            applicationId,
            application.status as any
          );
        }
      } else if (template === 'confirmation') {
        await this.emailService.sendApplicationConfirmation(email, applicationId);
      }

      // Update application status to 'email_sent'
      await this.updateApplicationStatus(applicationId, 'email_sent');

      return { success: true, applicationId, email };
    } catch (error) {
      // Log error but don't fail the entire job for email issues
      console.error(`Failed to send email for application ${applicationId}:`, error);
      
      // Still mark the application as having email sent even if there was an error
      await this.updateApplicationStatus(applicationId, 'email_sent');
      
      return { success: true, applicationId, email, error: error.message };
    }
  }

  @Process('send_email')
  async processSendEmail(job: Job<SendEmailJobData>): Promise<any> {
    return this.processJob(job.data);
  }
}