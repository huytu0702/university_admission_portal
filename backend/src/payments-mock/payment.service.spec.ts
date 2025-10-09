import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { PaymentService } from './payment.service';
import { Prisma } from '../../generated/prisma';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: PrismaService;
  let configService: ConfigService;
  let emailService: EmailService;

  // Mock data
  const mockApplication = {
    id: 'test-app-id',
    userId: 'test-user-id',
    status: 'submitted',
    personalStatement: 'Test statement',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'test-payment-id',
    paymentIntentId: 'pi_mock_123456789',
    applicationId: 'test-app-id',
    amount: 5000,
    currency: 'usd',
    status: 'pending',
    provider: 'mock',
    paymentUrl: 'http://localhost:3000/payment/pi_mock_123456789',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(), // Add the findUnique method
              update: jest.fn(),
            },
            application: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
            }
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPaymentConfirmation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent when application exists and no existing payment', async () => {
      const applicationId = 'test-app-id';
      const createPaymentDto = {
        applicationId,
        amount: 5000,
        currency: 'usd',
      };

      (prisma.application.findUnique as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null); // No existing payment
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'processing_payment',
      });

      const result = await service.createPaymentIntent(createPaymentDto);

      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: applicationId },
      });
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { applicationId },
      });
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId,
          amount: 5000,
          currency: 'usd',
          status: 'pending',
          provider: 'mock',
        }),
      });
      expect(result).toEqual({
        id: mockPayment.id,
        paymentIntentId: mockPayment.paymentIntentId,
        amount: mockPayment.amount,
        currency: mockPayment.currency,
        status: mockPayment.status,
        paymentUrl: mockPayment.paymentUrl,
      });
    });

    it('should update existing payment when application already has a payment', async () => {
      const applicationId = 'test-app-id';
      const createPaymentDto = {
        applicationId,
        amount: 6000, // Different amount
        currency: 'eur',
      };

      const existingPayment = {
        id: 'existing-payment-id',
        paymentIntentId: 'pi_mock_old_123',
        applicationId: 'test-app-id',
        amount: 5000,
        currency: 'usd',
        status: 'failed',
        provider: 'mock',
        paymentUrl: 'http://localhost:3000/payment/pi_mock_old_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPayment = {
        ...existingPayment,
        amount: 6000,
        currency: 'eur',
        status: 'pending',
        paymentIntentId: 'pi_mock_new_456',
        paymentUrl: 'http://localhost:3000/payment/pi_mock_new_456',
        updatedAt: new Date(),
      };

      (prisma.application.findUnique as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(existingPayment); // Existing payment
      (prisma.payment.update as jest.Mock).mockResolvedValue(updatedPayment);
      (prisma.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'processing_payment',
      });

      const result = await service.createPaymentIntent(createPaymentDto);

      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: applicationId },
      });
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { applicationId },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: existingPayment.id },
        data: expect.objectContaining({
          amount: 6000,
          currency: 'eur',
          status: 'pending',
          provider: 'mock',
        }),
      });
      expect(result).toEqual({
        id: updatedPayment.id,
        paymentIntentId: updatedPayment.paymentIntentId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: updatedPayment.status,
        paymentUrl: updatedPayment.paymentUrl,
      });
    });

    it('should throw an error if application does not exist', async () => {
      const createPaymentDto = {
        applicationId: 'non-existent-id',
        amount: 5000,
        currency: 'usd',
      };

      (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createPaymentIntent(createPaymentDto)).rejects.toThrow('Application not found');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm payment and update application status', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'succeeded',
      });
      (prisma.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'completed',
        progress: 100,
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.confirmPayment(mockPayment.paymentIntentId);

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { paymentIntentId: mockPayment.paymentIntentId },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: mockPayment.id },
        data: { status: 'succeeded' },
      });
      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: mockPayment.applicationId },
        data: { status: 'completed', progress: 100 },
      });
      expect(emailService.sendPaymentConfirmation).toHaveBeenCalledWith(mockUser.email, mockApplication.id);
      expect(result).toEqual({
        ...mockPayment,
        status: 'succeeded',
      });
    });

    it('should throw an error if payment does not exist', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.confirmPayment('non-existent-id')).rejects.toThrow('Payment not found');
    });

    it('should handle email sending errors gracefully', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'succeeded',
      });
      (prisma.application.update as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'completed',
        progress: 100,
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (emailService.sendPaymentConfirmation as jest.Mock).mockRejectedValue(new Error('Email error'));

      const result = await service.confirmPayment(mockPayment.paymentIntentId);

      expect(result).toEqual({
        ...mockPayment,
        status: 'succeeded',
      });
      expect(emailService.sendPaymentConfirmation).toHaveBeenCalledWith(mockUser.email, mockApplication.id);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status when payment exists', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.getPaymentStatus(mockPayment.paymentIntentId);

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { paymentIntentId: mockPayment.paymentIntentId },
      });
      expect(result).toEqual({
        paymentIntentId: mockPayment.paymentIntentId,
        status: mockPayment.status,
        amount: mockPayment.amount,
        currency: mockPayment.currency,
      });
    });

    it('should throw an error if payment does not exist', async () => {
      (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getPaymentStatus('non-existent-id')).rejects.toThrow('Payment not found');
    });
  });
});