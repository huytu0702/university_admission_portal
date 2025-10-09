import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModuleWrapper } from './config/config.module';
import { SecurityModule } from './config/security.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { DocumentsModule } from './documents/documents.module';
import { PaymentMockModule } from './payments-mock/payment.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthModule } from './health/health.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsCollectionMiddleware } from './middleware/metrics-collection.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModuleWrapper,
    SecurityModule.register(),
    AuthModule,
    DocumentsModule,
    ApplicationsModule,
    PaymentMockModule,
    MetricsModule,
    HealthModule,
    FeatureFlagsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsCollectionMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
