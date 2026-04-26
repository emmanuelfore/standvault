// Feature: stand-vault, Property 20: PoP submission enters queue as Pending
// Feature: stand-vault, Property 21: PoP approval creates a verified ledger entry
// Feature: stand-vault, Property 22: PoP rejection notifies buyer with reason

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PopService } from '../services/pop.services';
import { prisma } from '../db';
import { PopStatus } from '@prisma/client';

vi.mock('../services/milestone.services', () => ({
  MilestoneService: {
    evaluatePaymentMilestones: vi.fn(async () => {})
  }
}));

vi.mock('../db', () => ({
  prisma: {
    pop_submissions: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    ledger_entries: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    notifications: { create: vi.fn(), createMany: vi.fn() },
    buyers: { findUnique: vi.fn(), findMany: vi.fn() },
    milestones: { findMany: vi.fn(), create: vi.fn() },
    project_admin_assignments: { findMany: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Proof of Payment Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 20: PoP submission enters queue as Pending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          payment_date: fc.date(),
          file_url: fc.webUrl()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        async (payload, buyerId) => {
          vi.clearAllMocks();
          
          await PopService.submitPop(buyerId, payload);
          
          expect(prisma.pop_submissions.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                buyer_id: buyerId,
                amount: payload.amount,
                status: PopStatus.PENDING,
                file_url: payload.file_url
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 21: PoP approval creates a verified ledger entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // submission id
        fc.string({ minLength: 1 }), // user id
        async (submissionId, userId) => {
          vi.clearAllMocks();
          
          const mockPop = {
            id: submissionId,
            buyer_id: 'buyer-1',
            amount: 500,
            payment_date: new Date(),
            status: PopStatus.PENDING
          };

          vi.mocked(prisma.pop_submissions.findUnique).mockResolvedValue(mockPop as any);
          vi.mocked(prisma.ledger_entries.create).mockResolvedValue({ id: 'ledger-1' } as any);
          vi.mocked(prisma.pop_submissions.update).mockResolvedValue({ ...mockPop, status: PopStatus.APPROVED, ledger_entry_id: 'ledger-1' } as any);
          vi.mocked(prisma.notifications.create).mockResolvedValue({ id: 'notif-1' } as any);

          await PopService.approvePop(submissionId, userId);

          expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                entry_type: 'PAYMENT',
                is_verified: true,
                created_by: userId,
                amount: mockPop.amount
              })
            })
          );
          expect(prisma.pop_submissions.update).toHaveBeenCalledWith(
             expect.objectContaining({
                where: { id: submissionId },
                data: expect.objectContaining({
                   status: PopStatus.APPROVED,
                   ledger_entry_id: 'ledger-1'
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 22: PoP rejection notifies buyer with reason', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // submission id
        fc.string({ minLength: 5 }), // rejection reason
        async (submissionId, reason) => {
          vi.clearAllMocks();
          
          const mockPop = {
            id: submissionId,
            buyer_id: 'buyer-1',
            status: PopStatus.PENDING
          };

          vi.mocked(prisma.pop_submissions.findUnique).mockResolvedValue(mockPop as any);

          await PopService.rejectPop(submissionId, reason);

          expect(prisma.pop_submissions.update).toHaveBeenCalledWith(
             expect.objectContaining({
                where: { id: submissionId },
                data: expect.objectContaining({
                   status: PopStatus.REJECTED,
                   rejection_reason: reason
                })
             })
          );

          expect(prisma.notifications.create).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.objectContaining({
                   buyer_id: mockPop.buyer_id,
                   type: 'POP_REJECTED',
                   message: expect.stringContaining(reason)
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
