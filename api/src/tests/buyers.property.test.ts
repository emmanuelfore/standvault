// Feature: stand-vault, Property 11: Stand allocation sets status to Allocated
// Feature: stand-vault, Property 13: Buyer list filter correctness
// Feature: stand-vault, Property 14: Personal detail update does not alter ledger

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { BuyerService } from '../services/buyer.services';
import { prisma } from '../db';
import { StandStatus, PaymentStatus } from '@prisma/client';

vi.mock('../db', () => ({
  prisma: {
    project_configs: { findFirst: vi.fn() },
    stands: { findUnique: vi.fn(), updateMany: vi.fn() },
    users: { create: vi.fn() },
    buyers: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    tokens: { create: vi.fn() },
    instalment_schedules: { create: vi.fn() }
  }
}));

vi.mock('../services/schedule.services', () => ({
  ScheduleService: {
    calculateScheduleData: vi.fn().mockReturnValue({ periods: [] }),
    generateSchedule: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async (data: string) => `hashed_${data}`),
    compare: vi.fn(async (data: string, encrypted: string) => `hashed_${data}` === encrypted)
  }
}));

describe('Buyer Profile Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 11: Stand allocation sets status to Allocated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          stand_id: fc.string(),
          first_name: fc.string(),
          last_name: fc.string(),
          email: fc.string(),
          id_number: fc.string(),
          phone_number: fc.string()
        }),
        async (payload) => {
          vi.clearAllMocks();
          vi.mocked(prisma.project_configs.findFirst).mockResolvedValue({ id: 'config-1' } as any);
          vi.mocked(prisma.stands.findUnique).mockResolvedValue({ id: payload.stand_id, project_id: 'proj-1', status: StandStatus.AVAILABLE } as any);
          vi.mocked(prisma.stands.updateMany).mockResolvedValue({ count: 1 } as any);
          vi.mocked(prisma.users.create).mockResolvedValue({ id: 'user-1', buyer_profile: { id: 'buyer-1' } } as any);

          await BuyerService.createBuyer('proj-1', payload);

          expect(prisma.stands.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                id: payload.stand_id,
                project_id: 'proj-1',
                status: StandStatus.AVAILABLE
              }),
              data: { status: StandStatus.ALLOCATED }
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('Property 13: Buyer list filter correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.constantFrom(PaymentStatus.CURRENT, PaymentStatus.IN_ARREARS, PaymentStatus.FULLY_PAID, undefined),
        fc.constantFrom('true', 'false', undefined),
        async (name, stand_number, payment_status, arrears_status) => {
          vi.clearAllMocks();
          const filters: any = { name, stand_number, payment_status, arrears_status };
          
          await BuyerService.listProjectBuyers('proj-1', filters);

          // We check how Prisma is called to ensure filters are properly applied
          const findManyCall = vi.mocked(prisma.buyers.findMany).mock.calls[0][0];
          const query = findManyCall.where;

          expect(query.stand.project_id).toBe('proj-1');

          if (name) {
            expect(query.OR).toBeDefined();
          }
          if (stand_number) {
            expect(query.stand.stand_number.contains).toBe(stand_number);
          }
          if (payment_status) {
            expect(query.payment_status).toBe(payment_status);
          }
          if (arrears_status !== undefined) {
             expect(query.arrears_status).toBe(arrears_status === 'true');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 14: Personal detail update does not alter ledger', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          first_name: fc.string(),
          last_name: fc.string(),
          id_number: fc.string(),
          phone_number: fc.string()
        }),
        async (payload) => {
          vi.clearAllMocks();
          
          await BuyerService.updateBuyerDetails('buyer-1', payload);

          const updateCall = vi.mocked(prisma.buyers.update).mock.calls[0][0];
          const dataUpdate = updateCall.data;

          // Keys verified to NOT contain any ledger or financial fields
          const keys = Object.keys(dataUpdate);
          expect(keys).not.toContain('payment_status');
          expect(keys).not.toContain('arrears_status');
          expect(keys).not.toContain('project_config_id');
        }
      ),
      { numRuns: 100 }
    );
  });
});
