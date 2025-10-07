import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Application } from '../../generated/prisma';
import { ConfigService } from '@nestjs/config';

export type PaymentIntentDto = {
  applicationId: string;
  amount: number; // Amount in cents
  currency: string;
};

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createPaymentIntent(dto: PaymentIntentDto) {
    const { applicationId, amount, currency } = dto;

    // Verify the application exists
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new HttpException('Application not found', HttpStatus.NOT_FOUND);
    }

    // In a real implementation, you would call a payment provider (e.g., Stripe)
    // For this mock implementation, we'll simulate the payment creation
    const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Payment URL - in a real implementation this would be provided by the payment provider
    const paymentUrl = `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/payment/${paymentIntentId}`;
    
    // Create the payment record in the database
    const payment = await this.prisma.payment.create({
      data: {
        applicationId: applicationId,
        paymentIntentId,
        amount,
        currency: currency || 'usd',
        status: 'pending',
        paymentUrl,
        provider: 'mock',
      },
    });

    // Update the application status to reflect payment processing
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: 'processing_payment' },
    });

    return {
      id: payment.id,
      paymentIntentId: payment.paymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentUrl: payment.paymentUrl,
    };
  }

  async confirmPayment(paymentIntentId: string) {
    // Find the payment by paymentIntentId
    const payment = await this.prisma.payment.findFirst({
      where: { paymentIntentId },
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    // In a real implementation, you would verify with the payment provider
    // For this mock, we'll just update the status to 'succeeded'
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded' },
    });

    // Update the application status to 'paid'
    await this.prisma.application.update({
      where: { id: payment.applicationId },
      data: { status: 'paid' },
    });

    return updatedPayment;
  }

  async getPaymentStatus(paymentIntentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { paymentIntentId },
    });

    if (!payment) {
      throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
    }

    return {
      paymentIntentId: payment.paymentIntentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };
  }

  async handleWebhook(event: any) {
    // In a real implementation, you would process webhooks from the payment provider
    // For the mock, we'll just log the event
    console.log('Payment webhook received:', event);

    // Mock processing of different webhook events
    if (event.type === 'payment_intent.succeeded') {
      // Find the payment and update its status
      const payment = await this.prisma.payment.findFirst({
        where: {
          paymentIntentId: event.data.object.id,
        },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'succeeded' },
        });

        await this.prisma.application.update({
          where: { id: payment.applicationId },
          data: { status: 'paid' },
        });
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const payment = await this.prisma.payment.findFirst({
        where: {
          paymentIntentId: event.data.object.id,
        },
      });

      if (payment) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }
    }

    return { received: true };
  }
}