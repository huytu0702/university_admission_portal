import { Test, TestingModule } from '@nestjs/testing';
import { QueueProducerService } from '../queue/queue-producer.service';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';

describe('QueueProducerService', () => {
  let service: QueueProducerService;
  let verifyDocumentQueue: Queue;
  let createPaymentQueue: Queue;
  let sendEmailQueue: Queue;

  beforeEach(async () => {
    verifyDocumentQueue = {
      add: jest.fn(),
    } as any;
    
    createPaymentQueue = {
      add: jest.fn(),
    } as any;
    
    sendEmailQueue = {
      add: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueProducerService,
        {
          provide: getQueueToken('verify_document'),
          useValue: verifyDocumentQueue,
        },
        {
          provide: getQueueToken('create_payment'),
          useValue: createPaymentQueue,
        },
        {
          provide: getQueueToken('send_email'),
          useValue: sendEmailQueue,
        },
      ],
    }).compile();

    service = module.get<QueueProducerService>(QueueProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add a verify document job', async () => {
    const jobId = 'test-job-1';
    const data = { applicationFileId: 'file-123' };
    const priority = 'normal';

    await service.addVerifyDocumentJob(jobId, data, priority);

    expect(verifyDocumentQueue.add).toHaveBeenCalledWith(
      'verify_document',
      data,
      expect.objectContaining({
        jobId,
        priority,
      }),
    );
  });

  it('should add a create payment job', async () => {
    const jobId = 'test-job-2';
    const data = { applicationId: 'app-456' };
    const priority = 'normal';

    await service.addCreatePaymentJob(jobId, data, priority);

    expect(createPaymentQueue.add).toHaveBeenCalledWith(
      'create_payment',
      data,
      expect.objectContaining({
        jobId,
        priority,
      }),
    );
  });

  it('should add a send email job', async () => {
    const jobId = 'test-job-3';
    const data = { applicationId: 'app-789', email: 'test@example.com' };
    const priority = 'normal';

    await service.addSendEmailJob(jobId, data, priority);

    expect(sendEmailQueue.add).toHaveBeenCalledWith(
      'send_email',
      data,
      expect.objectContaining({
        jobId,
        priority,
      }),
    );
  });
});