// Feature: stand-vault, Property 39: Migration import accepts only valid file formats
// Feature: stand-vault, Property 41: Migration dry-run commits no data

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MigrationService } from '../services/migration.services';
import { prisma } from '../db';
import * as xlsx from 'xlsx';

vi.mock('../db', () => ({
  prisma: {
    ledger_entries: { findMany: vi.fn(), createMany: vi.fn() },
    migration_imports: { create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Migration Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 39: Migration import accepts only valid file formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // mimetype
        async (mimetype) => {
          vi.clearAllMocks();
          
          const validMimes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
          const isValid = validMimes.includes(mimetype);

          const buffer = Buffer.from('test');

          if (!isValid) {
             await expect(MigrationService.processMigration(buffer, mimetype, true, 'u1')).rejects.toMatchObject({
                status: 400
             });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 41: Migration dry-run commits no data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (isDryRun) => {
          vi.clearAllMocks();
          
          const wb = xlsx.utils.book_new();
          const ws = xlsx.utils.aoa_to_sheet([
             ['buyer_id', 'amount', 'entry_type', 'effective_date'],
             ['b1', 100, 'PAYMENT', '2023-01-01']
          ]);
          xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
          const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

          vi.mocked(prisma.ledger_entries.findMany).mockResolvedValue([]);

          const result = await MigrationService.processMigration(
             buffer,
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
             isDryRun,
             'user1'
          );

          if (isDryRun) {
             expect(prisma.ledger_entries.createMany).not.toHaveBeenCalled();
             expect(prisma.migration_imports.create).not.toHaveBeenCalled();
             expect(result.message).toContain('Dry run');
          } else {
             expect(prisma.ledger_entries.createMany).toHaveBeenCalled();
             expect(prisma.migration_imports.create).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 10 } // XLSX generation takes a bit, 10 runs is sufficient
    );
  });
});
