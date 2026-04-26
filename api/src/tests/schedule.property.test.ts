// Feature: stand-vault, Property 12: Schedule generation creates instalment periods separately
// Feature: stand-vault, Property 15: Balance status reflects ledger state

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ScheduleService } from '../services/schedule.services';
import { BuyerService } from '../services/buyer.services';
import { prisma } from '../db';
import { StandStatus, ScheduleStatus, Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

vi.mock('../db', () => ({
  prisma: {
    project_configs: { findFirst: vi.fn(), findUnique: vi.fn() },
    stands: { findUnique: vi.fn(), updateMany: vi.fn() },
    users: { create: vi.fn() },
    buyers: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    tokens: { create: vi.fn() },
    instalment_schedules: { create: vi.fn(), findFirst: vi.fn() },
    instalment_periods: { createMany: vi.fn() },
    ledger_entries: { findMany: vi.fn() }
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async (data: string) => `hashed_${data}`)
  }
}));

describe('Schedule Generation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 12: Schedule generation creates instalment periods separately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          deposit_pct: fc.double({ min: 10, max: 50 }),
          instalments_max: fc.integer({ min: 12, max: 60 }),
          interest_rate: fc.double({ min: 0, max: 20 })
        }),
        fc.record({
          size_sqm: fc.double({ min: 100, max: 1000 }),
          price_per_sqm: fc.integer({ min: 10, max: 100 })
        }),
        async (mockConfig, mockStand) => {
          vi.clearAllMocks();
          vi.mocked(prisma.buyers.findUnique).mockResolvedValue({
            id: 'buyer-1',
            stand: mockStand,
            config: mockConfig,
            schedules: []
          } as any);
          vi.mocked(prisma.instalment_schedules.create).mockResolvedValue({ id: 'sched-1' } as any);

          await ScheduleService.initializeSchedule('buyer-1');

          expect(prisma.instalment_schedules.create).toHaveBeenCalledOnce();
          const scheduleCall = vi.mocked(prisma.instalment_schedules.create).mock.calls[0][0];
          expect(scheduleCall.data.periods.create).toHaveLength(mockConfig.instalments_max);
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('Property 15: Balance status reflects ledger state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            amount: fc.double({ min: 10, max: 100, noNaN: true }),
            entry_type: fc.constantFrom('PAYMENT', 'REVERSAL')
          }), { maxLength: 10 }
        ),
        async (ledgerActions) => {
          vi.clearAllMocks();
          
          // One fake period expected so we can test arrears
          const schedule = {
            id: 'sched-1',
            periods: [
              { due_date: new Date(Date.now() - 1000), total_expected: new Decimal(500) }
            ]
          };

          vi.mocked(prisma.instalment_schedules.findFirst).mockResolvedValue(schedule as any);

          vi.mocked(prisma.ledger_entries.findMany).mockResolvedValue(ledgerActions.map(action => ({
             is_verified: true,
             entry_type: action.entry_type,
             amount: new Decimal(action.amount)
          })) as any);

          const balance = await ScheduleService.getBalance('buyer-1');

          // Manually compute expected paid
          let manualPaid = new Decimal(0);
          for (const a of ledgerActions) {
             if (a.entry_type === 'PAYMENT') manualPaid = manualPaid.add(new Decimal(a.amount));
             else if (a.entry_type === 'REVERSAL') manualPaid = manualPaid.sub(new Decimal(a.amount));
          }

          expect(balance.totalPaid.equals(manualPaid)).toBe(true);

          const manualArrears = schedule.periods[0].total_expected.sub(manualPaid);
          const inArrears = manualArrears.greaterThan(0);
          
          expect(balance.isInArrears).toBe(inArrears);
          if (inArrears) {
             expect(balance.arrearsAmount.equals(manualArrears)).toBe(true);
          } else {
             expect(balance.arrearsAmount.equals(0)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
