import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueProducerService } from '../queue/queue-producer.service';

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private prisma: PrismaService,
    private queueProducerService: QueueProducerService,
  ) {}

  async processOutbox(): Promise<void> {
    // Fetch unprocessed outbox messages (limit to 100 per batch to prevent overload)
    const outboxMessages = await this.prisma.outbox.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    for (const message of outboxMessages) {
      try {
        // Process the message based on its event type
        await this.processMessage(message);
        
        // Mark the message as processed
        await this.prisma.outbox.update({
          where: { id: message.id },
          data: { processedAt: new Date() },
        });
      } catch (error) {
        this.logger.error(`Error processing outbox message ${message.id}:`, error);
        // In a real implementation, you might want to implement DLQ here
      }
    }
  }

  private async processMessage(message: any): Promise<void> {
    const payload = JSON.parse(message.payload);
    
    switch (message.eventType) {
      // 📄 Step 1: Document uploaded → Start verification
      case 'document_uploaded':
        await this.queueProducerService.addVerifyDocumentJob(
          `verify_${message.id}`,
          payload,
          'normal'
        );
        this.logger.log(`Enqueued verify_document job for app: ${payload.applicationId}`);
        break;

      // ✅ Step 2: Documents verified → Start payment (only if verification succeeded)
      case 'document_verified':
        await this.queueProducerService.addCreatePaymentJob(
          `payment_${message.id}`,
          payload,
          'normal'
        );
        this.logger.log(`Enqueued create_payment job for app: ${payload.applicationId}`);
        break;

      // 💳 Step 3: Payment completed → Send confirmation email
      case 'payment_completed':
        await this.queueProducerService.addSendEmailJob(
          `email_${message.id}`,
          payload,
          'normal'
        );
        this.logger.log(`Enqueued send_email job for app: ${payload.applicationId}`);
        break;

      // 📧 Step 4: Email sent → Application completed
      case 'email_sent':
        // Mark application as completed
        await this.prisma.application.update({
          where: { id: payload.applicationId },
          data: { 
            status: 'completed',
            progress: 100,
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Application completed: ${payload.applicationId}`);
        break;

      default:
        this.logger.warn(`Unknown event type: ${message.eventType}`);
    }
  }
}