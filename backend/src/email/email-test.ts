import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailService } from './email.service';

async function testEmail() {
  const app = await NestFactory.create(AppModule);
  const emailService = app.get(EmailService);

  // Test sending a simple email
  const result = await emailService.sendMail({
    to: 'test@example.com',
    subject: 'Test Email',
    html: '<h1>This is a test email</h1>',
  });

  console.log('Email sent successfully:', result);
  await app.close();
}

// Uncomment the following line to run the test
// testEmail();