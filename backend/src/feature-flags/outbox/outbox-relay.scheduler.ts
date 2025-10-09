import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRelayService } from './outbox-relay.service';

@Injectable()
export class OutboxRelayScheduler implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelayScheduler.name);

  constructor(private outboxRelayService: OutboxRelayService) {}

  async onModuleInit() {
    // Process outbox once when module initializes
    await this.processOutboxMessages();
  }

  @Cron('*/2 * * * * *') // Every 2 seconds
  async handleCron() {
    this.logger.debug('Running scheduled outbox processing...');
    await this.processOutboxMessages();
  }

  private async processOutboxMessages() {
    try {
      await this.outboxRelayService.processOutbox();
    } catch (error) {
      this.logger.error('Error processing outbox messages:', error);
    }
  }
}