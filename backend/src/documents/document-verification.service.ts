import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ApplicationFile } from '../../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

@Injectable()
export class DocumentVerificationService {
  constructor(private prisma: PrismaService) {}

  async verifyDocument(fileId: string): Promise<ApplicationFile> {
    // Get the application file information
    const fileRecord = await this.prisma.applicationFile.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      throw new HttpException(
        `File with ID ${fileId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Simulate document verification with actual format validation
    const verificationResult = await this.performFormatValidation(fileRecord);

    if (verificationResult.isValid) {
      // Update the file record to mark it as verified
      return await this.prisma.applicationFile.update({
        where: { id: fileId },
        data: { verified: true },
      });
    } else {
      // Handle invalid documents by throwing an error
      throw new HttpException(
        `Document verification failed: ${verificationResult.issues?.join(', ')}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async performFormatValidation(fileRecord: ApplicationFile): Promise<{ isValid: boolean; issues?: string[] }> {
    const issues: string[] = [];
    
    // Check if the file exists
    if (!fs.existsSync(fileRecord.filePath)) {
      return {
        isValid: false,
        issues: ['File does not exist on disk']
      };
    }

    // Validate file type based on both extension and actual content
    await this.validateFileType(fileRecord, issues);

    // Validate file size (max 5MB as per application)
    await this.validateFileSize(fileRecord, issues);

    // Check if the file is readable
    await this.validateFileReadability(fileRecord, issues);

    // Additional format-specific validations
    await this.validateFormatSpecific(fileRecord, issues);

    return {
      isValid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  private async validateFileType(fileRecord: ApplicationFile, issues: string[]): Promise<void> {
    // Get the actual MIME type by reading the file header
    let actualMimeType: string;
    try {
      const buffer = await fsPromises.readFile(fileRecord.filePath, { encoding: null, flag: 'r' });
      
      // Check magic numbers to determine actual file type
      if (buffer.length >= 4) {
        if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          actualMimeType = 'application/pdf';
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          actualMimeType = 'image/jpeg';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          actualMimeType = 'image/png';
        } else {
          actualMimeType = 'unknown';
        }
      } else {
        actualMimeType = 'unknown';
      }
    } catch (error) {
      issues.push('Could not read file to determine actual type');
      return;
    }

    // Check if detected type matches declared type
    if (actualMimeType !== fileRecord.fileType) {
      issues.push(`File declared as ${fileRecord.fileType} but appears to be ${actualMimeType}`);
    }

    // Check if the file type is allowed
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(fileRecord.fileType)) {
      issues.push(`File type ${fileRecord.fileType} not allowed. Only PDF, JPEG, and PNG files are accepted.`);
    }
  }

  private async validateFileSize(fileRecord: ApplicationFile, issues: string[]): Promise<void> {
    try {
      const stats = await fsPromises.stat(fileRecord.filePath);
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes

      if (stats.size > maxSize) {
        issues.push(`File exceeds the maximum size of 5MB. Current size: ${Math.round(stats.size / 1024)}KB`);
      }
    } catch (error) {
      issues.push('Could not determine file size');
    }
  }

  private async validateFileReadability(fileRecord: ApplicationFile, issues: string[]): Promise<void> {
    try {
      // Try to read a small portion of the file to test readability
      await fsPromises.access(fileRecord.filePath, fs.constants.R_OK);
      
      // Read first 1KB to check for corruption
      const fileBuffer = await fsPromises.readFile(fileRecord.filePath);
      const sampleBuffer = fileBuffer.length > 1024 ? fileBuffer.slice(0, 1024) : fileBuffer;
      
      // For PDFs, check for proper header
      if (fileRecord.fileType === 'application/pdf') {
        if (!sampleBuffer.toString().startsWith('%PDF-')) {
          issues.push('PDF file does not have valid PDF header');
        }
      }
      
      // For images, basic validation
      if (['image/jpeg', 'image/jpg'].includes(fileRecord.fileType)) {
        if (sampleBuffer[0] !== 0xFF || sampleBuffer[1] !== 0xD8) {
          issues.push('JPEG file does not have valid JPEG header');
        }
      }
      
      if (fileRecord.fileType === 'image/png') {
        if (sampleBuffer[0] !== 0x89 || sampleBuffer[1] !== 0x50) {
          issues.push('PNG file does not have valid PNG header');
        }
      }
    } catch (error) {
      issues.push('File is not readable or appears to be corrupted');
    }
  }

  private async validateFormatSpecific(fileRecord: ApplicationFile, issues: string[]): Promise<void> {
    // Additional format-specific validation can go here
    if (fileRecord.fileType === 'application/pdf') {
      // Check if it's a valid PDF by checking for EOF marker
      try {
        const fileSize = (await fsPromises.stat(fileRecord.filePath)).size;
        if (fileSize >= 1024) {
          // For large files, read the last 1KB to check for EOF marker
          const fileBuffer = await fsPromises.readFile(fileRecord.filePath);
          const tailBuffer = fileBuffer.subarray(-1024); // Last 1024 bytes
          const tailString = tailBuffer.toString();
          if (!tailString.includes('%%EOF')) {
            issues.push('PDF file missing valid end-of-file marker');
          }
        } else {
          // For smaller files, just check the entire content
          const fileBuffer = await fsPromises.readFile(fileRecord.filePath);
          const fileString = fileBuffer.toString();
          if (!fileString.includes('%%EOF')) {
            issues.push('PDF file missing valid end-of-file marker');
          }
        }
      } catch (error) {
        issues.push('Could not validate PDF end-of-file marker');
      }
    }
  }

  async verifyAllDocumentsForApplication(applicationId: string): Promise<ApplicationFile[]> {
    // Get all files for the application
    const files = await this.prisma.applicationFile.findMany({
      where: { applicationId },
    });

    // Verify each file
    const verifiedFiles: ApplicationFile[] = [];
    for (const file of files) {
      try {
        const verifiedFile = await this.verifyDocument(file.id);
        verifiedFiles.push(verifiedFile);
      } catch (error) {
        // If a file fails verification, we throw an error to indicate 
        // that the entire application verification failed
        throw new HttpException(
          `Verification failed for file ${file.fileName}: ${error.message}`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    return verifiedFiles;
  }
}