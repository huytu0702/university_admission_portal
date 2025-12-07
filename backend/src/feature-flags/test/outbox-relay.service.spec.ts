import { Test, TestingModule } from '@nestjs/testing';
import { OutboxRelayService } from '../outbox/outbox-relay.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueProducerService } from '../queue/queue-producer.service';

describe('OutboxRelayService', () => {
  let service: OutboxRelayService;
  let prismaService: PrismaService;
  let queueProducerService: QueueProducerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            outbox: {
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: QueueProducerService,
          useValue: {
            addVerifyDocumentJob: jest.fn(),
            addCreatePaymentJob: jest.fn(),
            addSendEmailJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OutboxRelayService>(OutboxRelayService);
    prismaService = module.get<PrismaService>(PrismaService);
    queueProducerService = module.get<QueueProducerService>(QueueProducerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process outbox messages', async () => {
    const mockOutboxMessages = [
      {
        id: 'outbox-1',
        eventType: 'document_uploaded',
        payload: JSON.stringify({ applicationFileId: 'file-123' }),
        createdAt: new Date(),
        processedAt: null,
      },
    ];

    jest.spyOn(prismaService.outbox, 'findMany').mockResolvedValue(mockOutboxMessages as any);
    jest.spyOn(prismaService, '$transaction').mockImplementation(async (fn) => fn(prismaService));

    await service.processOutbox();

    expect(prismaService.outbox.findMany).toHaveBeenCalledWith({
      where: { processedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    expect(queueProducerService.addVerifyDocumentJob).toHaveBeenCalled();
  });
});