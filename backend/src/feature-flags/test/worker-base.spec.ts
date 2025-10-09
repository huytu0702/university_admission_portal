import { Test, TestingModule } from '@nestjs/testing';
import { WorkerBase } from '../workers/worker-base';
import { PrismaService } from '../../prisma/prisma.service';

// Create a concrete implementation for testing
class TestWorker extends WorkerBase {
  async processJob(job: any): Promise<any> {
    // Implementation not needed for this test
  }
}

describe('WorkerBase', () => {
  let worker: TestWorker;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TestWorker,
          useClass: TestWorker,
        },
        {
          provide: PrismaService,
          useValue: {
            application: {
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    worker = module.get<TestWorker>(TestWorker);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should update application status', async () => {
    const applicationId = 'app-123';
    const status = 'processing';
    
    const mockUpdatedApplication = {
      id: applicationId,
      status,
      progress: 25,
    };
    
    jest.spyOn(prismaService.application, 'update').mockResolvedValue(mockUpdatedApplication as any);

    const result = await worker.updateApplicationStatus(applicationId, status);
    expect(result).toEqual(mockUpdatedApplication);
    expect(prismaService.application.update).toHaveBeenCalledWith({
      where: { id: applicationId },
      data: { status, progress: expect.any(Number) },
    });
  });
});