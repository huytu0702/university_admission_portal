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
      case 'document_uploaded':
        await this.queueProducerService.addVerifyDocumentJob(
          `verify_${message.id}`,
          payload,
          'normal'
        );
        break;
      case 'application_submitted':
        await this.queueProducerService.addCreatePaymentJob(
          `payment_${message.id}`,
          payload,
          'normal'
        );
        break;
      case 'payment_completed':
        await this.queueProducerService.addSendEmailJob(
          `email_${message.id}`,
          payload,
          'normal'
        );
        break;
      default:
        this.logger.warn(`Unknown event type: ${message.eventType}`);
    }
  }
}