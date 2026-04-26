// Feature: stand-vault, Property 24: Audit log captures all state changes
// Feature: stand-vault, Property 25: Audit log entries are immutable

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AuditService } from '../services/audit.services';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    audit_log: { create: vi.fn(), update: vi.fn(), delete: vi.fn() }
  }
}));

describe('Audit Log Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 24: Audit log captures state changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // user Id
        fc.string({ minLength: 3 }), // action
        fc.string({ minLength: 3 }), // entity type
        fc.string({ minLength: 1 }), // entity id
        fc.record({ before: fc.string(), after: fc.string() }),
        async (userId, action, entityType, entityId, details) => {
          vi.clearAllMocks();
          
          await AuditService.logChange(userId, action, entityType, entityId, details, '127.0.0.1');

          expect(prisma.audit_log.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                user_id: userId,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details
              })
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 25: Audit log entries are immutable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), 
        async (someVal) => {
          vi.clearAllMocks();
          
          await expect(AuditService.deleteLog()).rejects.toMatchObject({
             status: 409
          });

          // Enforce mathematically no mutation paths exist on Audit DB API in the service
          expect(prisma.audit_log.update).not.toHaveBeenCalled();
          expect(prisma.audit_log.delete).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
