import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from '../feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: PrismaService,
          useValue: {
            featureFlag: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get all feature flags', async () => {
    const mockFlags = [
      { 
        id: '1', 
        name: 'queue-based-load-leveling', 
        description: 'Queue-Based Load Leveling', 
        enabled: true, 
        updatedAt: new Date() 
      },
      { 
        id: '2', 
        name: 'competing-consumers', 
        description: 'Competing Consumers', 
        enabled: false, 
        updatedAt: new Date() 
      },
    ];
    
    jest.spyOn(prismaService.featureFlag, 'findMany').mockResolvedValue(mockFlags as any);

    const result = await service.getAllFlags();
    expect(result).toEqual(mockFlags);
    expect(prismaService.featureFlag.findMany).toHaveBeenCalled();
  });

  it('should get a specific feature flag', async () => {
    const mockFlag = { 
      id: '1', 
      name: 'queue-based-load-leveling', 
      description: 'Queue-Based Load Leveling', 
      enabled: true, 
      updatedAt: new Date() 
    };
    
    jest.spyOn(prismaService.featureFlag, 'findFirst').mockResolvedValue(mockFlag as any);

    const result = await service.getFlag('queue-based-load-leveling');
    expect(result).toEqual(mockFlag);
    expect(prismaService.featureFlag.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: 'queue-based-load-leveling' },
          { name: 'queue-based-load-leveling' },
        ],
      },
    });
  });

  it('should update a feature flag', async () => {
    const flagName = 'queue-based-load-leveling';
    const enabled = false;
    const updatedFlag = { 
      id: '1', 
      name: flagName, 
      description: 'Queue-Based Load Leveling', 
      enabled, 
      updatedAt: new Date() 
    };
    
    jest.spyOn(prismaService.featureFlag, 'findFirst').mockResolvedValue(updatedFlag as any);
    jest.spyOn(prismaService.featureFlag, 'update').mockResolvedValue(updatedFlag as any);

    const result = await service.updateFlag(flagName, enabled);
    expect(result).toEqual(updatedFlag);
    expect(prismaService.featureFlag.update).toHaveBeenCalledWith({
      where: { id: updatedFlag.id },
      data: { 
        enabled, 
        updatedAt: expect.any(Date) 
      },
    });
  });

  it('should throw when updating a non-existent feature flag', async () => {
    jest.spyOn(prismaService.featureFlag, 'findFirst').mockResolvedValue(null as any);

    await expect(service.updateFlag('missing-flag', true)).rejects.toThrow('Feature flag \'missing-flag\' not found');
  });
});
