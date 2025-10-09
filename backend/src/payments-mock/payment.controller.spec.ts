import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ApplicationsService } from '../applications/applications.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: PaymentService;
  let applicationsService: ApplicationsService;

  const mockPaymentService = {
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    handleWebhook: jest.fn(),
  };

  const mockApplicationsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: ApplicationsService,
          useValue: mockApplicationsService,
        }
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
    applicationsService = module.get<ApplicationsService>(ApplicationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent if user owns the application', async () => {
      const req = {
        user: { userId: 'test-user-id' },
      };
      const createPaymentDto = {
        applicationId: 'test-app-id',
        amount: 5000,
        currency: 'usd',
      };
      
      jest.spyOn(applicationsService, 'findOne').mockResolvedValue({ id: 'test-app-id' });
      jest.spyOn(paymentService, 'createPaymentIntent').mockResolvedValue({
        id: 'test-payment-id',
        paymentIntentId: 'pi_mock_123456789',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        paymentUrl: 'http://localhost:3000/payment/pi_mock_123456789',
      });

      const result = await controller.createPaymentIntent(req, createPaymentDto);

      expect(applicationsService.findOne).toHaveBeenCalledWith('test-app-id', 'test-user-id');
      expect(paymentService.createPaymentIntent).toHaveBeenCalledWith({
        applicationId: 'test-app-id',
        amount: 5000,
        currency: 'usd',
      });
      expect(result).toEqual({
        id: 'test-payment-id',
        paymentIntentId: 'pi_mock_123456789',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        paymentUrl: 'http://localhost:3000/payment/pi_mock_123456789',
      });
    });

    it('should return forbidden error if user does not own the application', async () => {
      const req = {
        user: { userId: 'test-user-id' },
      };
      const createPaymentDto = {
        applicationId: 'test-app-id',
        amount: 5000,
        currency: 'usd',
      };

      jest.spyOn(applicationsService, 'findOne').mockResolvedValue(null);

      const result = await controller.createPaymentIntent(req, createPaymentDto);

      expect(result).toEqual({
        statusCode: 403,
        message: 'You do not have permission to create a payment for this application'
      });
    });
  });

  describe('confirmPayment', () => {
    it('should confirm a payment with valid paymentIntentId', async () => {
      const paymentIntentId = 'pi_mock_123456789';
      const mockPayment = {
        id: 'test-payment-id',
        paymentIntentId,
        applicationId: 'test-app-id',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
      };

      jest.spyOn(paymentService, 'confirmPayment').mockResolvedValue(mockPayment);

      const result = await controller.confirmPayment(paymentIntentId);

      expect(paymentService.confirmPayment).toHaveBeenCalledWith(paymentIntentId);
      expect(result).toEqual(mockPayment);
    });

    it('should throw an error for undefined paymentIntentId', async () => {
      const paymentIntentId = undefined;
      
      await expect(controller.confirmPayment(paymentIntentId)).rejects.toThrow();
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status for valid paymentIntentId', async () => {
      const paymentIntentId = 'pi_mock_123456789';
      const mockStatus = {
        paymentIntentId,
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
      };

      jest.spyOn(paymentService, 'getPaymentStatus').mockResolvedValue(mockStatus);

      const result = await controller.getPaymentStatus(paymentIntentId);

      expect(paymentService.getPaymentStatus).toHaveBeenCalledWith(paymentIntentId);
      expect(result).toEqual(mockStatus);
    });
  });
});