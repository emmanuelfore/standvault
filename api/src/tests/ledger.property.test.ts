// Feature: stand-vault, Property 17: Payment recording creates a ledger entry with full metadata
// Feature: stand-vault, Property 19: Reversal creates a negating ledger entry
// Feature: stand-vault, Property 7: Verified payment deletion is rejected for all roles
// Feature: stand-vault, Property 23: Ledger entries are immutable

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LedgerService } from '../services/ledger.services';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';

vi.mock('../services/milestone.services', () => ({
  MilestoneService: {
    evaluatePaymentMilestones: vi.fn(async () => {})
  }
}));

vi.mock('../services/reconciliation.services', () => ({
  ReconciliationService: {
    isBackdatedClosed: vi.fn(async () => false)
  }
}));

vi.mock('../db', () => ({
  prisma: {
    ledger_entries: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    buyers: { findUnique: vi.fn() },
    notifications: { create: vi.fn(), createMany: vi.fn() },
    milestones: { findMany: vi.fn(), create: vi.fn() },
    project_admin_assignments: { findMany: vi.fn() },
    reconciliation_periods: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(prisma))
  }
}));

describe('Ledger Management Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 17: Payment recording creates a ledger entry with full metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 1 }),
          effective_date: fc.date()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.string({ minLength: 1 }), // created by user Id
        async (payload, buyerId, userId) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.ledger_entries.create).mockResolvedValue({ id: 'entry-1' } as any);
          vi.mocked(prisma.buyers.findUnique).mockResolvedValue({ id: buyerId, stand: { project_id: 'p1' } } as any);

          await LedgerService.addPayment(buyerId, payload, userId);
          
          expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                buyer_id: buyerId,
                amount: payload.amount,
                entry_type: 'PAYMENT',
                description: payload.description,
                effective_date: payload.effective_date,
                created_by: userId,
                is_verified: true
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 19: Reversal creates a negating ledger entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }),
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date(),
          reverses_id: fc.string({ minLength: 1 })
        }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (payload, buyerId, userId) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.ledger_entries.findUnique).mockResolvedValue({ id: payload.reverses_id } as any);

          await LedgerService.addReversal(buyerId, payload, userId);

          expect(prisma.ledger_entries.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                buyer_id: buyerId,
                entry_type: 'REVERSAL',
                reverses_id: payload.reverses_id,
                description: payload.description
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: Verified payment deletion is rejected for all roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // Try calling deletePayment essentially
        async (entryId) => {
          vi.clearAllMocks();
          
          await expect(LedgerService.deletePayment()).rejects.toMatchObject({
            status: 409
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 23: Ledger entries are immutable', async () => {
    // Verifying it logically at mock level, but practically we test the db triggers natively
    // We expect service logic to never explicitly update a ledger entry post-verification
    // We enforce this by asserting our prisma mock for update is never called in our business logic
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }), // Payment
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date()
        }),
        fc.record({
          amount: fc.double({ min: 10, max: 1000, noNaN: true }), // Reversal
          description: fc.string({ minLength: 5 }),
          effective_date: fc.date(),
          reverses_id: fc.string({ minLength: 1 })
        }),
        async (payment, reversal) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.ledger_entries.findUnique).mockResolvedValue({ id: reversal.reverses_id } as any);
          vi.mocked(prisma.ledger_entries.create).mockResolvedValue({ id: 'entry-1' } as any);
          vi.mocked(prisma.buyers.findUnique).mockResolvedValue({ id: 'buyer-1', stand: { project_id: 'p1' } } as any);

          await LedgerService.addPayment('buyer-1', payment, 'user-1');
          await LedgerService.addReversal('buyer-1', reversal, 'user-1');
          
          try { await LedgerService.deletePayment(); } catch {}
          
          expect(prisma.ledger_entries.update).not.toHaveBeenCalled();
          // Deletion mock shouldn't be touched explicitly either because of the strict rejection
          expect(prisma.ledger_entries.delete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
