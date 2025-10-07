import { Module } from '@nestjs/common';
import { DocumentVerificationService } from './document-verification.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [DocumentVerificationService, PrismaService],
  exports: [DocumentVerificationService],
})
export class DocumentsModule {}