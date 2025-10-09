import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsSeederService } from './feature-flags-seeder.service';
import { QueueProducerService } from './queue/queue-producer.service';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { OutboxRelayScheduler } from './outbox/outbox-relay.scheduler';
import { AdminController } from './admin/admin.controller';
import { DocumentVerificationWorker } from './workers/document-verification.worker';
import { PaymentProcessingWorker } from './workers/payment-processing.worker';
import { EmailSendingWorker } from './workers/email-sending.worker';
import { ApplicationsModule } from '../applications/applications.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentMockModule } from '../payments-mock/payment.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'verify_document' },
      { name: 'create_payment' },
      { name: 'send_email' },
    ),
    ApplicationsModule,
    DocumentsModule,
    PaymentMockModule,
    EmailModule,
  ],
  controllers: [
    AdminController,
  ],
  providers: [
    PrismaService,
    FeatureFlagsService,
    FeatureFlagsSeederService,
    QueueProducerService,
    OutboxRelayService,
    OutboxRelayScheduler,
    DocumentVerificationWorker,
    PaymentProcessingWorker,
    EmailSendingWorker,
  ],
  exports: [
    FeatureFlagsService,
    QueueProducerService,
    OutboxRelayService,
  ],
})
export class FeatureFlagsModule {}