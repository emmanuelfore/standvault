// Feature: stand-vault, Property 45: Report export produces a downloadable file
// Feature: stand-vault, Property 46: Open reconciliation period adds provisional notice to reports

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ReportService } from '../services/report.services';
import { prisma } from '../db';
import { ScheduleService } from '../services/schedule.services';
import { Prisma } from '@prisma/client';
import { PassThrough } from 'stream';
const Decimal = Prisma.Decimal;

vi.mock('../db', () => ({
  prisma: {
    reconciliation_periods: { findFirst: vi.fn() },
    buyers: { findMany: vi.fn() }
  }
}));

vi.mock('../services/schedule.services', () => ({
  ScheduleService: {
    getBalanceBreakdown: vi.fn()
  }
}));

describe('Report Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 45 & 46: Report export sets correct header and includes provisional notice if open period exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('csv', 'xlsx', 'pdf', 'json'),
        fc.boolean(),
        async (format, hasOpenPeriod) => {
          vi.clearAllMocks();

          vi.mocked(prisma.reconciliation_periods.findFirst).mockResolvedValue(hasOpenPeriod ? { id: 'p1' } as any : null);
          vi.mocked(prisma.buyers.findMany).mockResolvedValue([]);
          
          let setHeaderArgs: any[] = [];
          let sendArgs: any[] = [];
          
          const mockRes = new PassThrough() as any;
          mockRes.setHeader = vi.fn((key, val) => setHeaderArgs.push([key, val]));
          mockRes.send = vi.fn((data) => sendArgs.push(data));
          mockRes.json = vi.fn((data) => sendArgs.push(data));

          await ReportService.generateReport('defaulters', 'proj-1', format, mockRes as any);

          if (format === 'csv') {
             expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
             const output = sendArgs[0];
             if (hasOpenPeriod) expect(output).toContain('PROVISIONAL DATA');
          } else if (format === 'xlsx') {
             expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('spreadsheetml'));
          } else if (format === 'pdf') {
             expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
          } else {
             const output = sendArgs[0];
             if (hasOpenPeriod) expect(output.notice).toBeTruthy();
             else expect(output.notice).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
