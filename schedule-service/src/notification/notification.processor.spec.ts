import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { NotificationProcessor, EmailJobData } from './notification.processor';

// Mock nodemailer
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let configService: ConfigService;

  beforeEach(async () => {
    // Reset mocks
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                SMTP_HOST: 'mailpit',
                SMTP_PORT: 1025,
                SMTP_FROM_EMAIL: 'noreply@healthcare-scheduling.com',
                SMTP_FROM_NAME: 'Healthcare Scheduling System',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('handleEmailJob - schedule_created', () => {
    it('should send confirmation email with correct format', async () => {
      // Arrange
      const jobData: EmailJobData = {
        type: 'schedule_created',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        doctorName: 'Dr. Smith',
        scheduledAt: '2026-10-15T07:00:00.000Z', // UTC timestamp
        objective: 'General checkup',
      };

      const job = {
        id: '123',
        data: jobData,
      } as Job<EmailJobData>;

      // Act
      await processor.handleEmailJob(job);

      // Assert
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Healthcare Scheduling System" <noreply@healthcare-scheduling.com>',
          to: 'customer@example.com',
          subject: 'Konfirmasi Jadwal - Dr. Smith',
          html: expect.stringContaining('Konfirmasi Jadwal Konsultasi'),
        }),
      );

      const emailHtml = mockSendMail.mock.calls[0][0].html;
      expect(emailHtml).toContain('John Doe');
      expect(emailHtml).toContain('Dr. Smith');
      expect(emailHtml).toContain('General checkup');
      expect(emailHtml).toContain('WIB'); // Jakarta timezone indicator
    });

    it('should convert UTC timestamp to Jakarta timezone', async () => {
      // Arrange
      const jobData: EmailJobData = {
        type: 'schedule_created',
        customerEmail: 'customer@example.com',
        customerName: 'Jane Doe',
        doctorName: 'Dr. Johnson',
        scheduledAt: '2026-10-15T07:00:00.000Z', // UTC (should be 14:00 WIB)
        objective: 'Follow-up',
      };

      const job = {
        id: '456',
        data: jobData,
      } as Job<EmailJobData>;

      // Act
      await processor.handleEmailJob(job);

      // Assert
      const emailHtml = mockSendMail.mock.calls[0][0].html;
      // The date should be displayed in Jakarta timezone (UTC+7)
      expect(emailHtml).toContain('14'); // Hour in Jakarta time
      expect(emailHtml).toContain('WIB');
    });
  });

  describe('handleEmailJob - schedule_cancelled', () => {
    it('should send cancellation email with correct format', async () => {
      // Arrange
      const jobData: EmailJobData = {
        type: 'schedule_cancelled',
        customerEmail: 'customer@example.com',
        customerName: 'Alice Brown',
        doctorName: 'Dr. Williams',
        scheduledAt: '2026-10-20T08:30:00.000Z', // UTC timestamp
        objective: 'Dental consultation',
      };

      const job = {
        id: '789',
        data: jobData,
      } as Job<EmailJobData>;

      // Act
      await processor.handleEmailJob(job);

      // Assert
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Healthcare Scheduling System" <noreply@healthcare-scheduling.com>',
          to: 'customer@example.com',
          subject: 'Pembatalan Jadwal - Dr. Williams',
          html: expect.stringContaining('Pembatalan Jadwal Konsultasi'),
        }),
      );

      const emailHtml = mockSendMail.mock.calls[0][0].html;
      expect(emailHtml).toContain('Alice Brown');
      expect(emailHtml).toContain('Dr. Williams');
      expect(emailHtml).toContain('Dental consultation');
      expect(emailHtml).toContain('dibatalkan');
      expect(emailHtml).toContain('WIB'); // Jakarta timezone indicator
    });

    it('should include cancellation notice in email', async () => {
      // Arrange
      const jobData: EmailJobData = {
        type: 'schedule_cancelled',
        customerEmail: 'customer@example.com',
        customerName: 'Bob Wilson',
        doctorName: 'Dr. Martinez',
        scheduledAt: '2026-11-01T03:00:00.000Z',
        objective: 'Surgery consultation',
      };

      const job = {
        id: '101',
        data: jobData,
      } as Job<EmailJobData>;

      // Act
      await processor.handleEmailJob(job);

      // Assert
      const emailHtml = mockSendMail.mock.calls[0][0].html;
      expect(emailHtml).toContain('Mohon maaf atas ketidaknyamanannya');
      expect(emailHtml).toContain('Pemberitahuan');
    });
  });

  describe('error handling', () => {
    it('should throw error when email sending fails', async () => {
      // Arrange
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const jobData: EmailJobData = {
        type: 'schedule_created',
        customerEmail: 'customer@example.com',
        customerName: 'Test User',
        doctorName: 'Dr. Test',
        scheduledAt: '2026-10-15T07:00:00.000Z',
        objective: 'Test',
      };

      const job = {
        id: '999',
        data: jobData,
      } as Job<EmailJobData>;

      // Act & Assert
      await expect(processor.handleEmailJob(job)).rejects.toThrow('SMTP connection failed');
    });

    it('should throw error for unknown email type', async () => {
      // Arrange
      const jobData = {
        type: 'unknown_type',
        customerEmail: 'customer@example.com',
        customerName: 'Test User',
        doctorName: 'Dr. Test',
        scheduledAt: '2026-10-15T07:00:00.000Z',
        objective: 'Test',
      } as any;

      const job = {
        id: '888',
        data: jobData,
      } as Job<EmailJobData>;

      // Act & Assert
      await expect(processor.handleEmailJob(job)).rejects.toThrow('Unknown email type: unknown_type');
    });
  });

  describe('configuration', () => {
    it('should use default values when environment variables are not set', async () => {
      // Arrange
      const mockConfigGet = jest.fn().mockReturnValue(undefined);
      const moduleWithDefaults = await Test.createTestingModule({
        providers: [
          NotificationProcessor,
          {
            provide: ConfigService,
            useValue: {
              get: mockConfigGet,
            },
          },
        ],
      }).compile();

      const processorWithDefaults = moduleWithDefaults.get<NotificationProcessor>(NotificationProcessor);

      const jobData: EmailJobData = {
        type: 'schedule_created',
        customerEmail: 'test@example.com',
        customerName: 'Test',
        doctorName: 'Dr. Test',
        scheduledAt: '2026-10-15T07:00:00.000Z',
        objective: 'Test',
      };

      const job = {
        id: '777',
        data: jobData,
      } as Job<EmailJobData>;

      // Act
      await processorWithDefaults.handleEmailJob(job);

      // Assert
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Healthcare Scheduling System" <noreply@healthcare-scheduling.com>',
        }),
      );
    });
  });
});
