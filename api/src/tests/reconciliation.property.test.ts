// Feature: stand-vault, Property 32: Reconciliation period close requires no pending PoP
// Feature: stand-vault, Property 33: Backdated payment requires approval

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ReconciliationService } from '../services/reconciliation.services';
import { LedgerService } from '../services/ledger.services';
import { prisma } from '../db';
import { PopStatus } from '@prisma/client';

vi.mock('../db', () => ({
  prisma: {
    buyers: { findUnique: vi.fn() },
    reconciliation_periods: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    pop_submissions: { count: vi.fn() },
    ledger_entries: { create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Reconciliation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 32: Reconciliation period close requires no pending PoP', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // periodId
        fc.string({ minLength: 1 }), // userId
        fc.integer({ min: 0, max: 10 }), // pending pop count
        async (periodId, userId, pendingPops) => {
          vi.clearAllMocks();

          const mockPeriod = {
             id: periodId,
             project_id: 'proj-1',
             start_date: new Date('2023-01-01'),
             end_date: new Date('2023-01-31'),
             is_closed: false
          };

          vi.mocked(prisma.reconciliation_periods.findUnique).mockResolvedValue(mockPeriod as any);
          vi.mocked(prisma.pop_submissions.count).mockResolvedValue(pendingPops);

          if (pendingPops > 0) {
             await expect(ReconciliationService.closePeriod(periodId, userId)).rejects.toMatchObject({
                status: 409
             });
             expect(prisma.reconciliation_periods.update).not.toHaveBeenCalled();
          } else {
             const result = await ReconciliationService.closePeriod(periodId, userId);
             expect(prisma.reconciliation_periods.update).toHaveBeenCalledWith(
                expect.objectContaining({
                   where: { id: periodId },
                   data: expect.objectContaining({
                      is_closed: true,
                      closed_by: userId
                   })
                })
             );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 33: Backdated payment requires approval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.boolean(), // is backdated?
        async (payload, buyerId, isBackdated) => {
          vi.clearAllMocks();
          
          const mockBuyer = {
             id: buyerId,
             stand: { project_id: 'proj-1' }
          };

          vi.mocked(prisma.buyers.findUnique).mockResolvedValue(mockBuyer as any);
          
          // isBackdatedClosed uses findFirst
          vi.mocked(prisma.reconciliation_periods.findFirst).mockResolvedValue(
             isBackdated ? { id: 'period-1' } as any : null
          );

          vi.mocked(prisma.ledger_entries.create).mockResolvedValue({ id: 'ledger-x' } as any);

          const result = await LedgerService.addPayment(buyerId, payload, 'user-1');

          if (isBackdated) {
             expect(result.requires_approval).toBe(true);
             expect(result.warning).toBeDefined();
             expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
                expect.objectContaining({
                   data: expect.objectContaining({
                      is_verified: false
                   })
                })
             );
          } else {
             expect(result.requires_approval).toBe(false);
             expect(result.warning).toBeNull();
             expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
                expect.objectContaining({
                   data: expect.objectContaining({
                      is_verified: true
                   })
                })
             );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
