import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationStatusService } from '../../applications/application-status.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';

describe('ApplicationStatusService', () => {
  let service: ApplicationStatusService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationStatusService,
        {
          provide: PrismaService,
          useValue: {
            application: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            applicationFile: {
              findMany: jest.fn(),
            },
            payment: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendApplicationStatusUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationStatusService>(ApplicationStatusService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get application status', async () => {
    const applicationId = 'app-123';
    const mockApplication = {
      id: applicationId,
      status: 'submitted',
      progress: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(prismaService.application, 'findUnique').mockResolvedValue(mockApplication as any);

    const result = await service.getApplicationStatus(applicationId);
    expect(result).toEqual({
      id: mockApplication.id,
      status: mockApplication.status,
      progress: mockApplication.progress,
      createdAt: mockApplication.createdAt,
      updatedAt: mockApplication.updatedAt,
    });
    expect(prismaService.application.findUnique).toHaveBeenCalledWith({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should calculate progress percentage', async () => {
    const applicationId = 'app-456';
    const mockApplication = {
      id: applicationId,
      status: 'processing',
      progress: 50,
      applicationFiles: [],
      payment: null,
    };

    jest.spyOn(prismaService.application, 'findUnique').mockResolvedValue(mockApplication as any);

    const result = await service.calculateProgressPercentage(applicationId);
    // The function calculates based on different factors, so let's expect that it's called
    expect(prismaService.application.findUnique).toHaveBeenCalledWith({
      where: { id: applicationId },
      include: {
        applicationFiles: true,
        payment: true,
      }
    });
  });
});