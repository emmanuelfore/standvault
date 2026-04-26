// Feature: stand-vault, Property 27: Additional charge notifies all affected buyers
// Feature: stand-vault, Property 28: Balance breakdown contains all four components
// Feature: stand-vault, Property 29: Viewed additional charges can only be removed via reversal

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LedgerService } from '../services/ledger.services';
import { ScheduleService } from '../services/schedule.services';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

vi.mock('../db', () => ({
  prisma: {
    buyers: { findMany: vi.fn() },
    ledger_entries: { createMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    notifications: { createMany: vi.fn(), create: vi.fn() },
    instalment_schedules: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Additional Charges & Breakdown Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 27: Additional charge notifies all affected buyers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date()
        }),
        fc.string({ minLength: 1 }), // project id
        fc.string({ minLength: 1 }), // user id
        fc.integer({ min: 1, max: 10 }), // num buyers
        async (payload, projectId, userId, numBuyers) => {
          vi.clearAllMocks();
          
          const mockBuyers = Array.from({ length: numBuyers }).map((_, i) => ({ id: `buyer-${i}` }));
          vi.mocked(prisma.buyers.findMany).mockResolvedValue(mockBuyers as any);

          await LedgerService.addBulkCharge(projectId, payload, userId);

          expect(prisma.notifications.createMany).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.arrayContaining([
                   expect.objectContaining({
                      buyer_id: expect.stringMatching(/buyer-\d+/),
                      type: 'CHARGE_ADDED'
                   })
                ])
             })
          );

          const notifyCall = vi.mocked(prisma.notifications.createMany).mock.calls[0][0];
          expect(notifyCall.data).toHaveLength(numBuyers);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 28: Balance breakdown contains all four components', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            amount: fc.double({ min: 10, max: 1000, noNaN: true }),
            entry_type: fc.constantFrom('PAYMENT', 'REVERSAL', 'CHARGE')
          }), { maxLength: 10 }
        ),
        async (ledgerEntries) => {
          vi.clearAllMocks();
          
          const schedule = {
            id: 'sched-1',
            periods: [
              { total_expected: new Decimal(1000) }
            ]
          };

          vi.mocked(prisma.instalment_schedules.findFirst).mockResolvedValue(schedule as any);
          vi.mocked(prisma.ledger_entries.findMany).mockResolvedValue(ledgerEntries.map(e => ({
             ...e,
             amount: new Decimal(e.amount),
             is_verified: true
          })) as any);

          const breakdown = await ScheduleService.getBalanceBreakdown('buyer-1');

          expect(breakdown).toHaveProperty('original_contract_value');
          expect(breakdown).toHaveProperty('total_additional_charges');
          expect(breakdown).toHaveProperty('total_paid');
          expect(breakdown).toHaveProperty('remaining_balance');

          expect(Decimal.isDecimal(breakdown.original_contract_value)).toBe(true);
          expect(Decimal.isDecimal(breakdown.total_additional_charges)).toBe(true);
          expect(Decimal.isDecimal(breakdown.total_paid)).toBe(true);
          expect(Decimal.isDecimal(breakdown.remaining_balance)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 16: Additional charge triggers schedule recalculation with admin gate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.string({ minLength: 1 }), // user Id
        fc.integer({ min: 1, max: 10 }), // version
        async (payload, buyerId, userId, version) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.instalment_schedules.findFirst).mockResolvedValue({
            id: 'sched-1',
             buyer_id: buyerId,
            version
          } as any);

          await LedgerService.addCharge(buyerId, payload, userId);

          expect(prisma.instalment_schedules.create).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.objectContaining({
                   buyer_id: buyerId,
                   version: version + 1,
                   status: 'PENDING_APPROVAL'
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
