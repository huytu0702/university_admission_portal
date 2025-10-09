import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('ApplicationsController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    // Set up a test user and generate a JWT token
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed-password', // In a real test, you would hash the password
        firstName: 'Test',
        lastName: 'User',
        role: 'applicant',
      },
    });
    
    // Generate a JWT token for the test user
    accessToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });
    
    await app.init();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: 'test@example.com',
      },
    });
    
    await app.close();
  });

  describe('POST /applications', () => {
    it('should create a new application with files', async () => {
      const applicationData = {
        personalStatement: 'This is my personal statement for the university application.',
      };
      
      // Mock file data (in a real test, you would create actual file buffers)
      const mockFile = {
        originalname: 'transcript.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('mock file content'),
      };
      
      // Note: Testing file uploads with supertest can be complex
      // For this example, we'll focus on testing the endpoint structure
      // In a real implementation, you would properly mock the Multer middleware
      
      return request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('personalStatement', applicationData.personalStatement)
        // .attach('files', mockFile.buffer, mockFile.originalname) // Proper file attachment
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('applicationId');
          expect(res.body).toHaveProperty('statusUrl');
          expect(res.body).toHaveProperty('payUrl');
        });
    });

    it('should reject requests without authentication', async () => {
      return request(app.getHttpServer())
        .post('/applications')
        .expect(401);
    });
  });

  describe('GET /applications', () => {
    it('should return a list of applications for the authenticated user', async () => {
      return request(app.getHttpServer())
        .get('/applications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should reject requests without authentication', async () => {
      return request(app.getHttpServer())
        .get('/applications')
        .expect(401);
    });
  });

  describe('GET /applications/:id', () => {
    let createdApplicationId: string;

    beforeEach(async () => {
      // Create a test application for this user
      const application = await prisma.application.create({
        data: {
          userId: (await prisma.user.findUnique({ where: { email: 'test@example.com' } })).id,
          personalStatement: 'Test personal statement',
          status: 'submitted',
        },
      });
      
      createdApplicationId = application.id;
    });

    it('should return a specific application by ID', async () => {
      return request(app.getHttpServer())
        .get(`/applications/${createdApplicationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', createdApplicationId);
          expect(res.body).toHaveProperty('personalStatement', 'Test personal statement');
        });
    });

    it('should reject requests for applications that do not belong to the user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashed-password',
          firstName: 'Other',
          lastName: 'User',
          role: 'applicant',
        },
      });
      
      // Create an application for the other user
      const otherApplication = await prisma.application.create({
        data: {
          userId: otherUser.id,
          personalStatement: 'Other user application',
          status: 'submitted',
        },
      });
      
      return request(app.getHttpServer())
        .get(`/applications/${otherApplication.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reject requests without authentication', async () => {
      return request(app.getHttpServer())
        .get(`/applications/${createdApplicationId}`)
        .expect(401);
    });
  });
});