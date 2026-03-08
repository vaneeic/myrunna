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

  describe('stravaActivityId field', () => {
    it('should link a Strava activity and auto-mark session completed', async () => {
      // Arrange
      const stravaId = '12345678901';
      const dto: UpdateSessionDto = { stravaActivityId: stravaId };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: false,
        completed: true,
        stravaActivityId: stravaId,
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
      expect(result.stravaActivityId).toBe(stravaId);
      expect(result.completed).toBe(true);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          stravaActivityId: stravaId,
          completed: true,
          skipped: false,
        }),
      );
    });

    it('should unlink a Strava activity when set to null', async () => {
      // Arrange
      const dto: UpdateSessionDto = { stravaActivityId: null };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = {
        id: mockSessionId,
        skipped: false,
        completed: false,
        stravaActivityId: null,
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
      expect(result.stravaActivityId).toBeNull();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ stravaActivityId: null }),
      );
    });

    it('should NOT auto-complete when stravaActivityId is set to null (unlink)', async () => {
      // Arrange — only stravaActivityId: null, no explicit completed field
      const dto: UpdateSessionDto = { stravaActivityId: null };
      const mockPlan = [{ id: mockPlanId }];
      const mockSession = [{ id: mockSessionId, weekId: mockWeekId }];
      const updatedSession = { id: mockSessionId, stravaActivityId: null, completed: false };

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

      await service.updateSession(mockPlanId, mockSessionId, mockUserId, dto);

      // completed should NOT have been forced to true
      expect(mockDb.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ completed: true }),
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
