// Feature: stand-vault, Property 50: Milestone triggered at correct thresholds

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MilestoneService } from '../services/milestone.services';
import { ScheduleService } from '../services/schedule.services';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

vi.mock('../services/schedule.services', () => ({
  ScheduleService: {
    getBalanceBreakdown: vi.fn()
  }
}));

vi.mock('../db', () => ({
  prisma: {
    buyers: { findUnique: vi.fn() },
    milestones: { findMany: vi.fn(), create: vi.fn() },
    notifications: { create: vi.fn(), createMany: vi.fn() },
    project_admin_assignments: { findMany: vi.fn() }
  }
}));

describe('Milestone Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 50: Milestone triggered at correct thresholds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 100, max: 10000, noNaN: true }), // totalPaid
        fc.record({
           contractValue: fc.double({ min: 10000, max: 100000, noNaN: true }),
           depositPct: fc.double({ min: 10, max: 20, noNaN: true })
        }),
        fc.string({ minLength: 1 }), // buyer Id
        async (totalPaidRaw, { contractValue, depositPct }, buyerId) => {
          vi.clearAllMocks();
          
          const mockBuyer = {
             id: buyerId,
             first_name: 'John',
             last_name: 'Doe',
             config: { deposit_pct: new Decimal(depositPct) },
             stand: { project_id: 'proj-1', stand_number: 'A1' }
          };

          vi.mocked(prisma.buyers.findUnique).mockResolvedValue(mockBuyer as any);
          vi.mocked(ScheduleService.getBalanceBreakdown).mockResolvedValue({
             original_contract_value: new Decimal(contractValue),
             contract_value_with_charges: new Decimal(contractValue),
             total_paid: new Decimal(totalPaidRaw)
          } as any);
          
          vi.mocked(prisma.milestones.findMany).mockResolvedValue([]);
          vi.mocked(prisma.project_admin_assignments.findMany).mockResolvedValue([{ user_id: 'admin-1' }] as any);

          await MilestoneService.evaluatePaymentMilestones(buyerId);

          const depositReq = (contractValue * depositPct) / 100;
          const percentage = (totalPaidRaw / contractValue) * 100;

          if (totalPaidRaw >= depositReq) {
             expect(prisma.milestones.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ milestone_type: 'DEPOSIT_CLEARED' })}));
          }
          if (percentage >= 25) {
             expect(prisma.milestones.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ milestone_type: '25_PERCENT_PAID' })}));
          }
          if (percentage >= 100) {
             expect(prisma.milestones.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ milestone_type: '100_PERCENT_PAID' })}));
             expect(prisma.notifications.createMany).toHaveBeenCalled(); // admin notification
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
