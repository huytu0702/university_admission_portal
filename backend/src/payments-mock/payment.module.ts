import { Module, forwardRef } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { CircuitBreakerService } from '../feature-flags/circuit-breaker/circuit-breaker.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [EmailModule, forwardRef(() => FeatureFlagsModule), forwardRef(() => ApplicationsModule)],
  providers: [PaymentService, PrismaService, ConfigService, CircuitBreakerService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentMockModule {}