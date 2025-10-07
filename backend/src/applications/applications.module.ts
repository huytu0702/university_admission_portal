import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { ApplicationStatusService } from './application-status.service';

@Module({
  imports: [DocumentsModule, EmailModule],
  providers: [ApplicationsService, PrismaService, ConfigService, ApplicationStatusService],
  controllers: [ApplicationsController],
  exports: [ApplicationsService, ApplicationStatusService],
})
export class ApplicationsModule {}