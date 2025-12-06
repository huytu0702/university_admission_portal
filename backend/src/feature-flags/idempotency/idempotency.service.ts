import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    private prisma: PrismaService,
    private featureFlagsService: FeatureFlagsService,
  ) { }

  async executeWithIdempotency<T>(
    idempotencyKey: string | undefined,
    operation: () => Promise<T>
  ): Promise<T> {
    // If no idempotency key is provided, just execute the operation
    if (!idempotencyKey) {
      this.logger.debug('No idempotency key provided, executing operation');
      return await operation();
    }

    this.logger.debug(`Idempotency key received: ${idempotencyKey}`);

    // Check if idempotency feature is enabled
    const flag = await this.featureFlagsService.getFlag('idempotency-key');
    if (!flag || !flag.enabled) {
      // If feature is disabled, execute operation directly
      this.logger.debug('Idempotency feature is disabled, executing operation');
      return await operation();
    }

    this.logger.log(`Idempotency feature enabled, checking key: ${idempotencyKey}`);

    // Look up if we already processed this idempotency key
    const existingRecord = await this.prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingRecord) {
      // If we already processed this request, return the cached result
      this.logger.log(`Returning cached result for idempotency key: ${idempotencyKey}`);

      // Parse the stored result
      const result = JSON.parse(existingRecord.result);
      return result as T;
    }

    try {
      // Execute the operation
      const result = await operation();

      // Store the result with the idempotency key
      await this.prisma.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          result: JSON.stringify(result),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      this.logger.log(`Stored result for idempotency key: ${idempotencyKey}`);
      return result;
    } catch (error) {
      // If the operation fails, don't store the idempotency key
      // This allows the client to retry with the same key
      this.logger.error(`Operation failed for idempotency key ${idempotencyKey}: ${error.message}`);
      throw error;
    }
  }

  // Cleanup method to remove expired idempotency keys (should be run periodically)
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired idempotency keys`);
    return result.count;
  }
}