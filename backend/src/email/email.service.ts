import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export type EmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  applicationId?: string;  // Optional application ID to link the email
};

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Configure the email transporter
    // In a real application, you would use actual SMTP settings
    // For this demo, we'll use a mock transporter
    this.transporter = nodemailer.createTransport({
      // This is a mock configuration for demo purposes.
      // In a real application, you would configure actual SMTP settings:
      // host: configService.get('EMAIL_HOST'),
      // port: configService.get('EMAIL_PORT'),
      // secure: configService.get('EMAIL_SECURE'), // true for 465, false for other ports
      // auth: {
      //   user: configService.get('EMAIL_USER'),
      //   pass: configService.get('EMAIL_PASS'),
      // },
      
      // For demo purposes, using a mock transporter that logs emails to console
      streamTransport: true,
      newline: '\r\n',
      buffer: true,
    });
  }

  async sendMail(options: EmailOptions): Promise<boolean> {
    try {
      // In a real application, you would send the actual email
      // For this demo, we'll simulate the email sending process
      console.log(`Email sent to: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Content: ${options.html || options.text}`);

      // Simulate the email sending with a 10% failure rate for demonstration
      const isSuccess = Math.random() > 0.1; // 90% success rate

      // Create email record in database
      await this.prisma.email.create({
        data: {
          toAddress: options.to,
          subject: options.subject,
          status: isSuccess ? 'sent' : 'failed',
          applicationId: options.applicationId || null,  // Link to application if provided
        }
      });

      return isSuccess;
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Log the email to the database with a failed status
      try {
        await this.prisma.email.create({
          data: {
            toAddress: options.to,
            subject: options.subject,
            status: 'failed',
            applicationId: options.applicationId || null,
          }
        });
      } catch (dbError) {
        console.error('Error logging failed email to database:', dbError);
      }
      
      return false;
    }
  }

  async sendApplicationConfirmation(email: string, applicationId: string): Promise<boolean> {
    const htmlContent = `
      <h1>Application Confirmation</h1>
      <p>Dear Applicant,</p>
      <p>Your application with ID: ${applicationId} has been successfully submitted.</p>
      <p>You can track the status of your application using our portal.</p>
      <p>Best regards,<br>University Admission Team</p>
    `;

    return this.sendMail({
      to: email,
      subject: 'Application Submitted Successfully',
      html: htmlContent,
      applicationId,
    });
  }

  async sendPaymentConfirmation(email: string, applicationId: string): Promise<boolean> {
    const htmlContent = `
      <h1>Payment Confirmation</h1>
      <p>Dear Applicant,</p>
      <p>Your payment for application ${applicationId} has been processed successfully.</p>
      <p>Thank you for your payment.</p>
      <p>Best regards,<br>University Admission Team</p>
    `;

    return this.sendMail({
      to: email,
      subject: 'Payment Confirmation',
      html: htmlContent,
      applicationId,
    });
  }

  async sendApplicationStatusUpdate(email: string, applicationId: string, status: string): Promise<boolean> {
    const htmlContent = `
      <h1>Application Status Update</h1>
      <p>Dear Applicant,</p>
      <p>The status of your application ${applicationId} has been updated to: ${status}.</p>
      <p>Please log in to your account to see more details.</p>
      <p>Best regards,<br>University Admission Team</p>
    `;

    return this.sendMail({
      to: email,
      subject: `Application ${applicationId} Status Update`,
      html: htmlContent,
      applicationId,
    });
  }
}