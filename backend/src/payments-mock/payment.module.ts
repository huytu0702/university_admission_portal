import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ApplicationsModule } from '../applications/applications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ApplicationsModule, EmailModule],
  providers: [PaymentService, PrismaService, ConfigService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentMockModule {}