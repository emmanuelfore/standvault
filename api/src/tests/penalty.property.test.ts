// Feature: stand-vault, Property 30: Penalty calculation respects grace period
// Feature: stand-vault, Property 31: Penalty commit reflects in ledger

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PenaltyService } from '../services/penalty.services';
import { ScheduleService } from '../services/schedule.services';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

vi.mock('../services/schedule.services', () => ({
  ScheduleService: {
    getSchedule: vi.fn(),
    getBalance: vi.fn()
  }
}));

vi.mock('../db', () => ({
  prisma: {
    buyers: { findUnique: vi.fn() },
    penalty_calculations: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    ledger_entries: { create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Penalty Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
  });

  it('Property 30: Penalty calculation respects grace period', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -10, max: 20 }), // Days offset from now for due date
        fc.double({ min: 10, max: 1000, noNaN: true }), // Arrears amount
        async (daysOffset, arrearsAmount) => {
          vi.clearAllMocks();
          
          const now = new Date();
          const dueDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

          const mockSchedule = {
             periods: [{ due_date: dueDate, period_number: 1 }]
          };

          const mockBuyer = {
             config: { penalty_rate: new Decimal(5) } // 5%
          };

          vi.mocked(ScheduleService.getSchedule).mockResolvedValue(mockSchedule as any);
          vi.mocked(ScheduleService.getBalance).mockResolvedValue({
             arrearsAmount: new Decimal(arrearsAmount)
          } as any);
          vi.mocked(prisma.buyers.findUnique).mockResolvedValue(mockBuyer as any);
          vi.mocked(prisma.penalty_calculations.create).mockResolvedValue({ status: 'PENDING_REVIEW' } as any);

          const result = await PenaltyService.calculatePenalty('buyer-1');

          // Grace period is 5 days.
          // If the due date was more than 5 days ago (meaning daysOffset <= -6) then penalty should trigger
          // Wait, actually `now > graceEnd`.
          // `graceEnd = dueDate + 5 days`.
          // So if `now > dueDate + 5` => `now - dueDate > 5` => `-daysOffset > 5` => `daysOffset < -5`.
          // Let's use `daysOffset <= -6`.
          if (daysOffset <= -6) {
             expect(prisma.penalty_calculations.create).toHaveBeenCalled();
             expect(result).toHaveProperty('status', 'PENDING_REVIEW');
          } else {
             expect(prisma.penalty_calculations.create).not.toHaveBeenCalled();
             expect(result).toHaveProperty('status', 'NO_PENALTY_APPLICABLE');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 31: Penalty commit reflects in ledger', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // calcId
        fc.string({ minLength: 1 }), // userId
        fc.double({ min: 10, max: 1000, noNaN: true }), // amount
        async (calcId, userId, amount) => {
          vi.clearAllMocks();

          const mockCalc = {
             id: calcId,
             buyer_id: 'buyer-1',
             calculated_amount: new Decimal(amount),
             status: 'PENDING_REVIEW',
             period_overdue: 1
          };

          vi.mocked(prisma.penalty_calculations.findUnique).mockResolvedValue(mockCalc as any);

          await PenaltyService.approvePenalty(calcId, userId);

          expect(prisma.penalty_calculations.update).toHaveBeenCalledWith(
             expect.objectContaining({
                where: { id: calcId },
                data: { status: 'APPROVED' }
             })
          );

          expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.objectContaining({
                   entry_type: 'PENALTY',
                   amount: mockCalc.calculated_amount,
                   is_verified: true,
                   created_by: userId
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
