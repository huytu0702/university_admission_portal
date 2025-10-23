import { Test, TestingModule } from '@nestjs/testing';
import { AdminController, UpdateFeatureFlagDto } from '../admin/admin.controller';
import { FeatureFlagsService } from '../feature-flags.service';
import { DlqService } from '../workers/dlq.service';

describe('AdminController', () => {
  let controller: AdminController;
  let featureFlagsService: FeatureFlagsService;
  let dlqService: DlqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: FeatureFlagsService,
          useValue: {
            getAllFlags: jest.fn(),
            updateFlag: jest.fn(),
          },
        },
        {
          provide: DlqService,
          useValue: {
            getFailedJobs: jest.fn(),
            requeueJob: jest.fn(),
            purgeFailedJobs: jest.fn(),
            getDlqMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    featureFlagsService = module.get<FeatureFlagsService>(FeatureFlagsService);
    dlqService = module.get<DlqService>(DlqService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get all feature flags', async () => {
    const mockFlags = [
      { id: '1', name: 'queue-based-load-leveling', description: 'Queue-Based Load Leveling', enabled: true, updatedAt: new Date() },
      { id: '2', name: 'competing-consumers', description: 'Competing Consumers', enabled: false, updatedAt: new Date() },
    ];
    
    jest.spyOn(featureFlagsService, 'getAllFlags').mockResolvedValue(mockFlags as any);

    const result = await controller.getFeatureFlags();
    expect(result).toEqual(mockFlags);
  });

  it('should update a feature flag', async () => {
    const flagName = 'queue-based-load-leveling';
    const enabled = false;
    const mockUpdatedFlag = { 
      id: '1', 
      name: flagName, 
      description: 'Queue-Based Load Leveling', 
      enabled, 
      updatedAt: new Date() 
    };
    
    jest.spyOn(featureFlagsService, 'updateFlag').mockResolvedValue(mockUpdatedFlag as any);

    const result = await controller.updateFeatureFlag(flagName, { enabled });
    expect(result).toEqual(mockUpdatedFlag);
    expect(featureFlagsService.updateFlag).toHaveBeenCalledWith(flagName, enabled);
  });
});