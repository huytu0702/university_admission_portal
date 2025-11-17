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
import { WorkerManagementController } from './workers/worker-management.controller';
import { DocumentVerificationWorker } from './workers/document-verification.worker';
import { PaymentProcessingWorker } from './workers/payment-processing.worker';
import { EmailSendingWorker } from './workers/email-sending.worker';
import { DlqService } from './workers/dlq.service';
import { WorkerScalingService } from './workers/worker-scaling.service';
import { WorkerPoolService } from './workers/worker-pool.service';
import { WorkerLoadBalancerService } from './workers/worker-load-balancer.service';
import { BulkheadService } from './bulkhead/bulkhead.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { forwardRef } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { EmailModule } from '../email/email.module';
import { PaymentMockModule } from '../payments-mock/payment.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
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
    DocumentsModule,
    EmailModule,
    forwardRef(() => PaymentMockModule),
  ],
  controllers: [AdminController, WorkerManagementController],
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
    DlqService,
    WorkerScalingService,
    WorkerPoolService,
    WorkerLoadBalancerService,
    BulkheadService,
    CircuitBreakerService,
    IdempotencyService,
  ],
  exports: [
    FeatureFlagsService,
    QueueProducerService,
    OutboxRelayService,
    WorkerScalingService,
    WorkerPoolService,
    WorkerLoadBalancerService,
    CircuitBreakerService,
  ],
})
export class FeatureFlagsModule {}
