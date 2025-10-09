import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagsSeederService implements OnApplicationBootstrap {
  constructor(private prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedFeatureFlags();
  }

  private async seedFeatureFlags() {
    // Define the default feature flags based on the PRD
    const defaultFlags = [
      {
        name: 'queue-based-load-leveling',
        description: 'Queue-Based Load Leveling (BullMQ/Redis) - Required pattern',
        enabled: true, // Required pattern, so should be enabled by default
      },
      {
        name: 'competing-consumers',
        description: 'Competing Consumers: Multiple workers for verify, payment, email jobs',
        enabled: true,
      },
      {
        name: 'cache-aside',
        description: 'Cache-Aside: Cache program/major listings, fee structures, admission configs (TTL: 10 mins)',
        enabled: true,
      },
      {
        name: 'idempotency-key',
        description: 'Idempotency Key: Prevent duplicate requests using Idempotency-Key header',
        enabled: true,
      },
      {
        name: 'retry-exponential-backoff',
        description: 'Retry + Exponential Backoff: Automatic retries with backoff, DLQ for failed jobs',
        enabled: true,
      },
      {
        name: 'circuit-breaker-payment',
        description: 'Circuit Breaker (Payment): Protect payment service from cascading failures',
        enabled: true,
      },
      {
        name: 'bulkhead-isolation',
        description: 'Bulkhead Isolation: Separate worker pools with concurrency limits',
        enabled: true,
      },
      {
        name: 'outbox-pattern',
        description: 'Outbox Pattern: Transactional message publishing using outbox table',
        enabled: true,
      },
      {
        name: 'cqrs-lite',
        description: 'CQRS-light: Read-optimized application_view table for status queries',
        enabled: true,
      },
    ];

    // Check if flags already exist to avoid duplicates on restart
    for (const flag of defaultFlags) {
      const existingFlag = await this.prisma.featureFlag.findUnique({
        where: { name: flag.name },
      });

      if (!existingFlag) {
        await this.prisma.featureFlag.create({
          data: {
            name: flag.name,
            description: flag.description,
            enabled: flag.enabled,
          },
        });
        console.log(`Created feature flag: ${flag.name}`);
      }
    }
  }
}