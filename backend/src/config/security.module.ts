import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import helmet from 'helmet';

export const configureSecurity = (app) => {
  // Enable CORS with configuration from environment
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Apply Helmet security headers
  app.use(helmet());

  // Apply additional security headers
  app.use(helmet.hidePoweredBy());
  app.use(helmet.frameguard({ action: 'deny' }));
  app.use(helmet.noSniff());
  app.use(helmet.xssFilter());
  app.use(
    helmet.hsts({
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    }),
  );
};

@Module({})
export class SecurityModule {
  static register(): DynamicModule {
    return {
      module: SecurityModule,
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: (configService: ConfigService) => [
            {
              ttl: configService.get('THROTTLE_TTL', 60000), // Time window in milliseconds
              limit: configService.get('THROTTLE_LIMIT', 100000000000), // Max requests per time window (increased for testing)
            },
          ],
          inject: [ConfigService],
        }),
      ],
      exports: [],
    };
  }
}