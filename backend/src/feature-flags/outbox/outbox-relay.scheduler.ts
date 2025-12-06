import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRelayService } from './outbox-relay.service';
import { FeatureFlagsService } from '../feature-flags.service';

@Injectable()
export class OutboxRelayScheduler implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelayScheduler.name);

  constructor(
    private outboxRelayService: OutboxRelayService,
    private featureFlagsService: FeatureFlagsService,
  ) { }

  async onModuleInit() {
    // Process outbox once when module initializes (if enabled)
    await this.processOutboxMessages();
  }

  @Cron('*/2 * * * * *') // Every 2 seconds
  async handleCron() {
    await this.processOutboxMessages();
  }

  private async processOutboxMessages() {
    try {
      // Check if outbox pattern is enabled before processing
      const outboxFlag = await this.featureFlagsService.getFlag('outbox-pattern');
      if (!outboxFlag || !outboxFlag.enabled) {
        // Skip processing if flag is disabled
        return;
      }

      this.logger.debug('Running scheduled outbox processing...');
      await this.outboxRelayService.processOutbox();
    } catch (error) {
      this.logger.error('Error processing outbox messages:', error);
    }
  }
}