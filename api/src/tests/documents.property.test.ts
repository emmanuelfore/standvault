// Feature: stand-vault, Property 34: Document versioning preserves all versions
// Feature: stand-vault, Property 35: Transfer deed upload triggers milestone

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { DocumentService } from '../services/document.services';
import { prisma } from '../db';

vi.mock('../db', () => ({
  prisma: {
    documents: { findFirst: vi.fn(), create: vi.fn() },
    document_versions: { findFirst: vi.fn(), create: vi.fn() },
    milestones: { create: vi.fn() },
    notifications: { create: vi.fn() },
    $transaction: vi.fn(async (callback) => {
      return await callback(prisma);
    })
  }
}));

describe('Document Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 34: Document versioning preserves all versions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 3 }),
          document_type: fc.constant('invoice'),
          file_url: fc.webUrl()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.string({ minLength: 1 }), // user Id
        fc.integer({ min: 1, max: 20 }), // Current version
        async (payload, buyerId, userId, currentVersion) => {
          vi.clearAllMocks();
          
          const mockDoc = { id: 'doc-1' };
          
          vi.mocked(prisma.documents.findFirst).mockResolvedValue(mockDoc as any);
          vi.mocked(prisma.document_versions.findFirst).mockResolvedValue({ version_number: currentVersion } as any);

          await DocumentService.uploadDocument(buyerId, payload, userId);

          // We expect a new version, so currentVersion + 1
          expect(prisma.document_versions.create).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.objectContaining({
                   document_id: 'doc-1',
                   version_number: currentVersion + 1,
                   file_url: payload.file_url,
                   uploaded_by: userId
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 35: Transfer deed upload triggers milestone', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 3 }),
          document_type: fc.constantFrom('transfer_deed', 'contract', 'id_copy'),
          file_url: fc.webUrl()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.string({ minLength: 1 }), // user Id
        async (payload, buyerId, userId) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.documents.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.documents.create).mockResolvedValue({ id: 'doc-new' } as any);

          await DocumentService.uploadDocument(buyerId, payload, userId);

          if (payload.document_type === 'transfer_deed') {
             expect(prisma.milestones.create).toHaveBeenCalledWith(
                expect.objectContaining({
                   data: expect.objectContaining({
                      buyer_id: buyerId,
                      milestone_type: 'TRANSFER_DEED_UPLOADED'
                   })
                })
             );
          } else {
             expect(prisma.milestones.create).not.toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 36: Document upload notifies buyer', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 3 }),
          document_type: fc.constant('contract'),
          file_url: fc.webUrl()
        }),
        fc.string({ minLength: 1 }), // buyer Id
        fc.string({ minLength: 1 }), // user Id
        async (payload, buyerId, userId) => {
          vi.clearAllMocks();
          
          vi.mocked(prisma.documents.findFirst).mockResolvedValue(null);
          vi.mocked(prisma.documents.create).mockResolvedValue({ id: 'doc-1' } as any);

          await DocumentService.uploadDocument(buyerId, payload, userId);

          expect(prisma.notifications.create).toHaveBeenCalledWith(
             expect.objectContaining({
                data: expect.objectContaining({
                   buyer_id: buyerId,
                   type: 'DOCUMENT_UPLOADED',
                   title: 'New Document Uploaded'
                })
             })
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
