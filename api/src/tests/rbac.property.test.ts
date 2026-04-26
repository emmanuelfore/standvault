// Feature: stand-vault, Property 4: Buyer data isolation
// Feature: stand-vault, Property 5: Project administrator project isolation
// Feature: stand-vault, Property 6: Buyer cannot mutate financial records
// Feature: stand-vault, Property 8: Unauthorised access is logged

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { requireBuyerIsolation, requireProjectIsolation, preventBuyerFinancialMutation, requireRole } from '../middlewares/rbac';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    buyers: { findUnique: vi.fn() },
    project_admin_assignments: { findUnique: vi.fn() },
    audit_log: { create: vi.fn() }
  }
}));

const mockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => vi.fn();

describe('RBAC Middleware Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 4: Buyer data isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('BUYER', 'PROJECT_ADMIN', 'SYSTEM_ADMIN'),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.boolean(), // Does param exist?
        fc.boolean(), // Is same buyer?
        async (role, userId, requestedBuyerId, hasParam, isSame) => {
          const req: any = {
            user: { role, userId },
            params: hasParam ? { buyer_id: requestedBuyerId } : {},
            body: {},
            originalUrl: '/test'
          };
          const res = mockResponse();
          const next = mockNext();

          const dbBuyerId = isSame ? requestedBuyerId : 'different-buyer-id';
          vi.mocked(prisma.buyers.findUnique).mockResolvedValue({ id: dbBuyerId } as any);

          await requireBuyerIsolation(req, res, next);

          if (role !== 'BUYER' || !hasParam || isSame) {
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
          } else {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(prisma.audit_log.create).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: Project administrator project isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('PROJECT_ADMIN', 'SYSTEM_ADMIN', 'BUYER'),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.boolean(), // has Param
        fc.boolean(), // Is assigned
        async (role, userId, requestedProjectId, hasParam, isAssigned) => {
          const req: any = {
            user: { role, userId },
            params: hasParam ? { project_id: requestedProjectId } : {},
            body: {}
          };
          const res = mockResponse();
          const next = mockNext();

          if (isAssigned) {
            vi.mocked(prisma.project_admin_assignments.findUnique).mockResolvedValue({ id: 'assignment-id' } as any);
          } else {
            vi.mocked(prisma.project_admin_assignments.findUnique).mockResolvedValue(null);
          }

          await requireProjectIsolation(req, res, next);

          if (role === 'SYSTEM_ADMIN' || !hasParam) {
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
          } else if (role === 'PROJECT_ADMIN') {
            if (isAssigned) {
              expect(next).toHaveBeenCalled();
              expect(res.status).not.toHaveBeenCalled();
            } else {
              expect(res.status).toHaveBeenCalledWith(403);
              expect(prisma.audit_log.create).toHaveBeenCalled();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6: Buyer cannot mutate financial records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('BUYER', 'PROJECT_ADMIN', 'SYSTEM_ADMIN'),
        fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
        fc.constantFrom('/ledger', '/charges', '/penalty', '/pop/approve', '/pop/reject', '/pop/submit', '/profile'),
        async (role, method, path) => {
          const req: any = {
            user: { role, userId: 'user-1' },
            method,
            originalUrl: path
          };
          const res = mockResponse();
          const next = mockNext();

          await preventBuyerFinancialMutation(req, res, next);

          const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
          const isFinancialPath = path.includes('/ledger') || path.includes('/charges') || path.includes('/penalty') || path.includes('/pop');
          
          let shouldBlock = false;
          if (role === 'BUYER' && isMutation && isFinancialPath) {
            shouldBlock = true;
            if (path.includes('/pop') && method === 'POST' && !path.includes('/approve') && !path.includes('/reject')) {
              shouldBlock = false;
            }
          }

          if (shouldBlock) {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(prisma.audit_log.create).toHaveBeenCalled();
          } else {
            expect(next).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 8: Unauthorised access is logged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('BUYER', 'PROJECT_ADMIN'),
        fc.array(fc.constantFrom('SYSTEM_ADMIN'), { minLength: 1, maxLength: 1 }),
        async (userRole, allowedRoles) => {
          const req: any = {
            user: { role: userRole, userId: 'user-1' },
            originalUrl: '/admin-only'
          };
          const res = mockResponse();
          const next = mockNext();

          const middleware = requireRole(allowedRoles);
          await middleware(req, res, next);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(prisma.audit_log.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
              action: 'UNAUTHORIZED_ACCESS',
              details: expect.objectContaining({ reason: 'ROLE_RESTRICTION' })
            })
          }));
        }
      ),
      { numRuns: 100 }
    );
  });
});
