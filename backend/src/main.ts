import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureSecurity } from './config/security.module';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply security configurations
  configureSecurity(app);

  // Apply request logging middleware
  app.use(new RequestLoggingMiddleware().use.bind(new RequestLoggingMiddleware()));

  // Apply global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('University Admission Portal API')
    .setDescription('API documentation for the University Admission Portal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
