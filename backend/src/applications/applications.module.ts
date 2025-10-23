import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { ApplicationStatusService } from './application-status.service';
import { IdempotencyService } from '../feature-flags/idempotency/idempotency.service';
import { QueueProducerService } from '../feature-flags/queue/queue-producer.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [DocumentsModule, EmailModule, FeatureFlagsModule],
  providers: [
    ApplicationsService, 
    PrismaService, 
    ConfigService, 
    ApplicationStatusService,
    IdempotencyService
  ],
  controllers: [ApplicationsController],
  exports: [ApplicationsService, ApplicationStatusService],
})
export class ApplicationsModule {}