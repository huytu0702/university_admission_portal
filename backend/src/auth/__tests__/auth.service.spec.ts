import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// Mock implementations
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'JWT_SECRET') return 'mock-secret';
    if (key === 'JWT_EXPIRES_IN') return '1h';
    return null;
  }),
};

const mockPrismaService = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
};

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const firstName = 'Test';
      const lastName = 'User';

      // Mock prisma user creation
      const mockUser = {
        id: '1',
        email,
        firstName,
        lastName,
        role: 'applicant',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register(email, password, firstName, lastName);

      expect(result).toEqual({
        id: '1',
        email,
        firstName,
        lastName,
        role: 'applicant',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email,
          password: 'hashed-password',
          firstName,
          lastName,
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('validateUser', () => {
    it('should return user object if credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const mockUser = {
        id: '1',
        email,
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'applicant',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password);

      expect(result).toEqual({
        id: '1',
        email,
        firstName: 'Test',
        lastName: 'User',
        role: 'applicant',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(password, 'hashed-password');
    });

    it('should return null if user does not exist', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should return null if password is incorrect', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';

      const mockUser = {
        id: '1',
        email,
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'applicant',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(password, 'hashed-password');
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens for valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const mockUser = {
        id: '1',
        email,
        firstName: 'Test',
        lastName: 'User',
        role: 'applicant',
      };

      // Mock validateUser to return a user
      jest.spyOn(service as any, 'validateUser').mockResolvedValue(mockUser);

      const result = await service.login(email, password);

      expect(result).toEqual({
        access_token: 'mock-token',
        refresh_token: 'mock-token',
        user: {
          id: '1',
          email,
          role: 'applicant',
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw an error for invalid credentials', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';

      // Mock validateUser to return null
      jest.spyOn(service as any, 'validateUser').mockResolvedValue(null);

      await expect(service.login(email, password)).rejects.toThrow('Invalid credentials');
    });
  });
});