import { Test, TestingModule } from '@nestjs/testing';
import { TrainingPlansService } from './training-plans.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { NotFoundException } from '@nestjs/common';
import { UpdateSessionDto } from './dto/update-session.dto';

describe('TrainingPlansService - updateSession', () => {
  let service: TrainingPlansService;
  let mockDb: any;
  let mockGoogleCalendarService: any;

  const mockPlanId = 'plan-123';
  const mockSessionId = 'session-456';
  const mockUserId = 'user-789';
  const mockWeekId = 'week-101';

  beforeEach(async () => {
    // Mock database interactions
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    // Mock Google Calendar Service
    mockGoogleCalendarService = {
      updateSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlansService,
        {
          provide: 'DB_CONNECTION',
          useValue: mockDb,
        },
        {
          provide: GoogleCalendarService,
          useValue: mockGoogleCalendarService,
        },
      ],
    }).compile();

    service = module.get<TrainingPlansService>(TrainingPlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('skipped field', () => {
    it('should mark a session as skipped', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: true };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: true,
        completed: false,
        stravaActivityUrl: null,
      };

      mockDb.select.mockReturnValueOnce(mockDb); // For plan verification
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb); // For session verification
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.skipped).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ skipped: true }),
      );
    });

    it('should unskip a session (mark skipped as false)', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: false };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: false,
        completed: false,
        stravaActivityUrl: null,
      };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.skipped).toBe(false);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ skipped: false }),
      );
    });
  });

  describe('stravaActivityUrl field', () => {
    it('should set a Strava activity URL for a session', async () => {
      // Arrange
      const stravaUrl = 'https://www.strava.com/activities/123456789';
      const dto: UpdateSessionDto = { stravaActivityUrl: stravaUrl };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: false,
        completed: false,
        stravaActivityUrl: stravaUrl,
      };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.stravaActivityUrl).toBe(stravaUrl);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ stravaActivityUrl: stravaUrl }),
      );
    });

    it('should update Strava activity URL (edit existing)', async () => {
      // Arrange
      const newStravaUrl = 'https://www.strava.com/activities/987654321';
      const dto: UpdateSessionDto = { stravaActivityUrl: newStravaUrl };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: true,
        stravaActivityUrl: newStravaUrl,
      };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.stravaActivityUrl).toBe(newStravaUrl);
    });

    it('should clear Strava activity URL when set to empty string', async () => {
      // Arrange
      const dto: UpdateSessionDto = { stravaActivityUrl: '' };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: true,
        stravaActivityUrl: '',
      };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.stravaActivityUrl).toBe('');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ stravaActivityUrl: '' }),
      );
    });
  });

  describe('combined skipped and stravaActivityUrl', () => {
    it('should mark session as skipped with Strava URL simultaneously', async () => {
      // Arrange
      const stravaUrl = 'https://www.strava.com/activities/555666777';
      const dto: UpdateSessionDto = {
        skipped: true,
        stravaActivityUrl: stravaUrl,
      };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: true,
        completed: false,
        stravaActivityUrl: stravaUrl,
      };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.stravaActivityUrl).toBe(stravaUrl);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          skipped: true,
          stravaActivityUrl: stravaUrl,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundException when plan does not exist', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: true };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce([]); // No plan found

      // Act & Assert
      await expect(
        service.updateSession(mockPlanId, mockSessionId, mockUserId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: true };
      const mockPlan = [{ id: mockPlanId }];

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce([]); // No session found

      // Act & Assert
      await expect(
        service.updateSession(mockPlanId, mockSessionId, mockUserId, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Google Calendar integration', () => {
    it('should trigger Google Calendar update after session update', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: true };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = { id: mockSessionId, skipped: true };

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      await service.updateSession(mockPlanId, mockSessionId, mockUserId, dto);

      // Assert
      expect(mockGoogleCalendarService.updateSession).toHaveBeenCalledWith(
        mockUserId,
        mockSessionId,
        mockPlanId,
      );
    });

    it('should handle Google Calendar update failure gracefully', async () => {
      // Arrange
      const dto: UpdateSessionDto = { skipped: true };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = { id: mockSessionId, skipped: true };

      mockGoogleCalendarService.updateSession.mockRejectedValueOnce(
        new Error('Calendar API error'),
      );

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockPlan);

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.innerJoin.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.limit.mockResolvedValueOnce(mockSession);

      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([updatedSession]);

      // Act
      const result = await service.updateSession(
        mockPlanId,
        mockSessionId,
        mockUserId,
        dto,
      );

      // Assert - should still return updated session despite calendar error
      expect(result.skipped).toBe(true);
    });
  });
});
