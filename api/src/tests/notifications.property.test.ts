// Feature: stand-vault, Property 46: Announcement broadcast creates notifications for all targeted buyers

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { NotificationService } from '../services/notification.services';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    buyers: { findMany: vi.fn() },
    notifications: { createMany: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Notification Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 46: Announcement broadcast creates notifications for targeted buyers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 3 }),
          message: fc.string({ minLength: 5 }),
          buyerIds: fc.array(fc.string({ minLength: 1 }))
        }),
        fc.string({ minLength: 1 }), // projectId
        fc.string({ minLength: 1 }), // userId
        async (payload, projectId, userId) => {
          vi.clearAllMocks();
          
          const mockBuyers = (payload.buyerIds.length > 0 ? payload.buyerIds : ['b1', 'b2']).map(id => ({ id }));
          
          vi.mocked(prisma.buyers.findMany).mockResolvedValue(mockBuyers as any);

          const result = await NotificationService.broadcastAnnouncement(projectId, payload, userId);

          expect(prisma.notifications.createMany).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.arrayContaining([
                   expect.objectContaining({
                      title: payload.title,
                      message: payload.message,
                      type: 'ANNOUNCEMENT',
                      user_id: userId
                   })
                ])
             })
          );
          
          expect(result.broadcastCount).toBe(mockBuyers.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
