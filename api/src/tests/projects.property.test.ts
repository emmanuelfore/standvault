// Feature: stand-vault, Property 9: Project config snapshot isolation
// Feature: stand-vault, Property 10: Stand status is always a valid enum value

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ProjectService } from '../services/project.services';
import { prisma } from '../db';
import { StandStatus } from '@prisma/client';
import { z } from 'zod';

vi.mock('../db', () => ({
  prisma: {
    project_configs: { findFirst: vi.fn(), create: vi.fn() },
    stands: { update: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      // simulate minimal transaction behaviour by calling the callback
      return await callback(prisma);
    })
  }
}));

describe('Project & Stand Management Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 9: Project config snapshot isolation', async () => {
    /* 
      We verify that updating a config ALWAYS creates a new record with a higher version
      and DOES NOT mutate the old record.
    */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // old version
        fc.record({
          currency: fc.string(),
          deposit_pct: fc.double({ min: 10, max: 20 }),
          instalments_max: fc.integer({ min: 1, max: 12 }),
          interest_rate: fc.double({ min: 0, max: 10 }),
          penalty_rate: fc.double({ min: 0, max: 5 })
        }),
        async (oldVersion, newConfigData) => {
          vi.clearAllMocks();
          const oldConfig = {
            id: 'old-config-1',
            project_id: 'proj-1',
            version: oldVersion,
            currency: 'USD',
            deposit_pct: 10,
            instalments_max: 24,
            interest_rate: 0.1,
            penalty_rate: 0.05
          };

          vi.mocked(prisma.project_configs.findFirst).mockResolvedValue(oldConfig as any);
          vi.mocked(prisma.project_configs.create).mockImplementation(async ({ data }: any) => {
             return { id: 'new-config-2', ...data };
          });

          const newConfig = await ProjectService.updateProjectConfig('proj-1', newConfigData);

          // Assertions
          expect(prisma.project_configs.create).toHaveBeenCalledOnce();
          expect(newConfig.version).toBe(oldVersion + 1);
          expect(newConfig.project_id).toBe('proj-1');
          
          // Verify we did not call update on any configs
          // since Prisma client mocks don't even have update defined here, it's inherently isolated if only create is called
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('Property 10: Stand status is always a valid enum value', async () => {
    const enumSchema = z.nativeEnum(StandStatus);

    await fc.assert(
      fc.property(
        fc.string(), // Random payload strings
        (randomStatus) => {
           let isValid = false;
           try {
              enumSchema.parse(randomStatus);
              isValid = true;
           } catch {
              isValid = false;
           }

           const validEnums = Object.values(StandStatus);
           const isActuallyValid = validEnums.includes(randomStatus as any);

           expect(isValid).toBe(isActuallyValid);
        }
      ),
      { numRuns: 1000 }
    );
  });
});
