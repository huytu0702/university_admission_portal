import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Application } from '../../generated/prisma';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { ApplicationStatus } from '../applications/application-status.service';
import { CircuitBreakerService } from '../feature-flags/circuit-breaker/circuit-breaker.service';

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
    private emailService: EmailService,
    private circuitBreakerService: CircuitBreakerService,
  ) {}

  async createPaymentIntent(dto: PaymentIntentDto) {
    // Execute the payment creation with circuit breaker protection
    return await this.circuitBreakerService.executeWithCircuitBreaker(
      'payment-service',
      async () => {
        const { applicationId, amount, currency } = dto;

        // Verify the application exists
        const application = await this.prisma.application.findUnique({
          where: { id: applicationId },
        });

        if (!application) {
          throw new HttpException('Application not found', HttpStatus.NOT_FOUND);
        }

        // Check if a payment already exists for this application
        let payment = await this.prisma.payment.findUnique({
          where: { applicationId },
        });

        if (payment) {
          // If payment already exists, update it instead of creating a new one
          // This handles scenarios where a user might try to pay again
          const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const paymentUrl = `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/payment/${paymentIntentId}`;
          
          payment = await this.prisma.payment.update({
            where: { 
              id: payment.id 
            },
            data: {
              amount,
              currency: currency || 'usd',
              status: 'pending',
              paymentIntentId: paymentIntentId,
              paymentUrl: paymentUrl,
              provider: 'mock',
              updatedAt: new Date(), // Update the timestamp
            },
          });
        } else {
          // In a real implementation, you would call a payment provider (e.g., Stripe)
          // For this mock implementation, we'll simulate the payment creation
          const paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Payment URL - in a real implementation this would be provided by the payment provider
          const paymentUrl = `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/payment/${paymentIntentId}`;
          
          // Create the payment record in the database
          payment = await this.prisma.payment.create({
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
        }

        // Update the application status to reflect payment processing
        await this.prisma.application.update({
          where: { id: applicationId },
          data: { status: ApplicationStatus.PROCESSING_PAYMENT },
        });

        return {
          id: payment.id,
          paymentIntentId: payment.paymentIntentId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentUrl: payment.paymentUrl,
        };
      },
      {
        failureThreshold: 3,
        timeout: 30000, // 30 seconds
        resetTimeout: 60000, // 1 minute
      }
    );
  }

  async confirmPayment(paymentIntentId: string) {
    // Validate that paymentIntentId is provided
    if (!paymentIntentId || paymentIntentId === 'undefined') {
      throw new HttpException('Payment intent ID is required', HttpStatus.BAD_REQUEST);
    }

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

    // Update the application status to 'completed' and set progress to 100%
    const updatedApplication = await this.prisma.application.update({
      where: { id: payment.applicationId },
      data: { 
        status: ApplicationStatus.COMPLETED,
        progress: 100, // 100% progress after payment
      },
    });

    // Send payment confirmation email
    try {
      // Get the user's email for the payment confirmation
      const user = await this.prisma.user.findFirst({
        where: { id: updatedApplication.userId },
        select: { email: true }
      });

      if (user && user.email) {
        await this.emailService.sendPaymentConfirmation(user.email, updatedApplication.id);
      } else {
        console.warn(`No email found for user ${updatedApplication.userId}, skipping payment confirmation email`);
      }
    } catch (error) {
      console.error('Failed to send payment confirmation email:', error);
      // Don't fail the payment confirmation if email sending fails
    }

    return updatedPayment;
  }

  async getPaymentStatus(paymentIntentId: string) {
    // Validate that paymentIntentId is provided
    if (!paymentIntentId || paymentIntentId === 'undefined') {
      throw new HttpException('Payment intent ID is required', HttpStatus.BAD_REQUEST);
    }

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

        const updatedApplication = await this.prisma.application.update({
          where: { id: payment.applicationId },
          data: { 
            status: ApplicationStatus.COMPLETED,
            progress: 100, // 100% progress after payment
          },
        });

        // Send payment confirmation email
        try {
          // Get the user's email for the payment confirmation
          const user = await this.prisma.user.findFirst({
            where: { id: updatedApplication.userId },
            select: { email: true }
          });

          if (user) {
            await this.emailService.sendPaymentConfirmation(user.email, updatedApplication.id);
          }
        } catch (error) {
          console.error('Failed to send payment confirmation email:', error);
          // Don't fail the webhook processing if email sending fails
        }
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