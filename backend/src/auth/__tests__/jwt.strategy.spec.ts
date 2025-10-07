import { JwtStrategy } from '../jwt.strategy';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'JWT_SECRET') return 'mock-secret';
    return null;
  }),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfigService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object with userId, email, and role', async () => {
      const payload = {
        sub: '1',
        email: 'test@example.com',
        role: 'applicant',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: '1',
        email: 'test@example.com',
        role: 'applicant',
      });
    });
  });
});