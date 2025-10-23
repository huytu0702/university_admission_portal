import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Application } from '../../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { DocumentVerificationService } from '../documents/document-verification.service';
import { EmailService } from '../email/email.service';
import { IdempotencyService } from '../feature-flags/idempotency/idempotency.service';
import { QueueProducerService } from '../feature-flags/queue/queue-producer.service';

export type CreateApplicationDto = {
  personalStatement?: string;
  files: import('multer').File[];
};

@Injectable()
export class ApplicationsService {
  private readonly uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private documentVerificationService: DocumentVerificationService,
    private emailService: EmailService,
    private idempotencyService: IdempotencyService,
    private queueProducerService: QueueProducerService,
  ) {
    // Create upload directory if it doesn't exist
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createApplication(userId: string, dto: CreateApplicationDto, idempotencyKey?: string) {
    // Execute with idempotency if key is provided
    return await this.idempotencyService.executeWithIdempotency(
      idempotencyKey,
      async () => {
        // Get user's email for sending confirmation
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        });

        if (!user) {
          throw new HttpException(
            'User not found',
            HttpStatus.NOT_FOUND,
          );
        }

        // Validate files if provided
        const validatedFiles = dto.files && dto.files.length > 0
          ? await this.validateAndStoreFiles(dto.files)
          : [];

        // Create the application with initial status
        const application = await this.prisma.$transaction(async (tx) => {
          // Create the application
          const newApplication = await tx.application.create({
            data: {
              userId,
              personalStatement: dto.personalStatement,
              status: 'submitted',
            },
          });

          // Create application files if any
          if (validatedFiles.length > 0) {
            for (const file of validatedFiles) {
              await tx.applicationFile.create({
                data: {
                  applicationId: newApplication.id,
                  fileName: file.originalName,
                  fileType: file.mimeType,
                  fileSize: file.size,
                  filePath: file.path, // Path where the file is stored
                },
              });
            }
          }

          // Create outbox message for document verification
          if (validatedFiles.length > 0) {
            await tx.outbox.create({
              data: {
                eventType: 'document_uploaded',
                payload: JSON.stringify({
                  applicationId: newApplication.id,
                  applicationFileIds: validatedFiles.map(f => f.path), // Store file paths for processing
                }),
              },
            });
          }

          // Create outbox message for payment processing
          await tx.outbox.create({
            data: {
              eventType: 'application_submitted',
              payload: JSON.stringify({
                applicationId: newApplication.id,
              }),
            },
          });

          return newApplication;
        });

        // After creating the application, enqueue jobs for processing
        // This maintains the queue-based load leveling feature
        
        // Enqueue document verification job if files were uploaded
        if (validatedFiles.length > 0) {
          await this.queueProducerService.addVerifyDocumentJob(
            `verify-${application.id}`,
            {
              applicationId: application.id,
              applicationFileIds: validatedFiles.map(f => f.path),
            }
          );
        }
        
        // Enqueue payment processing job
        await this.queueProducerService.addCreatePaymentJob(
          `payment-${application.id}`,
          {
            applicationId: application.id,
          }
        );

        // Return information needed for the client instead of the application object
        return {
          applicationId: application.id,
          statusUrl: `/applications/${application.id}/status`,
          payUrl: `/payments/checkout/${application.id}`,
        };
      }
    );
  }

  private async validateAndStoreFiles(files: Array<import('multer').File>): Promise<Array<{
    originalName: string,
    mimeType: string,
    size: number,
    path: string
  }>> {
    if (!files || files.length === 0) {
      return [];
    }

    const validatedFiles: Array<{
      originalName: string,
      mimeType: string,
      size: number,
      path: string
    }> = [];
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes

    for (const file of files) {
      // Validate file type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException(
          `File type ${file.mimetype} not allowed. Only PDF, JPEG, and PNG files are accepted.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new HttpException(
          `File ${file.originalname} exceeds the maximum size of 5MB.`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Move file to permanent location
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(this.uploadDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      validatedFiles.push({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
      });
    }

    return validatedFiles;
  }

  async findOne(id: string, userId: string) {
    return this.prisma.application.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        applicationFiles: true,
        payment: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      include: {
        applicationFiles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(applicationId: string, status: string) {
    return this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
    });
  }
}