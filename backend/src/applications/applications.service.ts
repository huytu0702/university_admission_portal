import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Application } from '../../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { DocumentVerificationService } from '../documents/document-verification.service';

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
  ) {
    // Create upload directory if it doesn't exist
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createApplication(userId: string, dto: CreateApplicationDto): Promise<Application> {
    // Validate files if provided
    const validatedFiles = dto.files && dto.files.length > 0
      ? await this.validateAndStoreFiles(dto.files)
      : [];

    // Create the application with initial status
    const application = await this.prisma.application.create({
      data: {
        userId,
        personalStatement: dto.personalStatement,
        status: 'submitted',
      },
    });

    // Process uploaded files if any
    if (validatedFiles.length > 0) {
      for (const file of validatedFiles) {
        const applicationFile = await this.prisma.applicationFile.create({
          data: {
            applicationId: application.id,
            fileName: file.originalName,
            fileType: file.mimeType,
            fileSize: file.size,
            filePath: file.path, // Path where the file is stored
          },
        });

        // Synchronously verify the document after it's saved
        await this.documentVerificationService.verifyDocument(applicationFile.id);
      }

      // Update application status to reflect that documents have been verified
      await this.prisma.application.update({
        where: { id: application.id },
        data: { status: 'verified' },
      });
    }

    return application;
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