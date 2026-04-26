"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const db_1 = require("../db");
class DocumentService {
    static async uploadDocument(buyerId, data, userId) {
        const { title, document_type, file_url } = data;
        return await db_1.prisma.$transaction(async (tx) => {
            let document = await tx.documents.findFirst({
                where: { buyer_id: buyerId, document_type, title }
            });
            let nextVersion = 1;
            if (!document) {
                document = await tx.documents.create({
                    data: { buyer_id: buyerId, title, document_type }
                });
            }
            else {
                const latestVersion = await tx.document_versions.findFirst({
                    where: { document_id: document.id },
                    orderBy: { version_number: 'desc' }
                });
                nextVersion = (latestVersion ? latestVersion.version_number : 0) + 1;
            }
            await tx.document_versions.create({
                data: {
                    document_id: document.id,
                    version_number: nextVersion,
                    file_url,
                    uploaded_by: userId
                }
            });
            // 17.6 Enqueue buyer notification
            await tx.notifications.create({
                data: {
                    buyer_id: buyerId,
                    title: 'New Document Uploaded',
                    message: `A new document (${title}) has been added to your vault.`,
                    type: 'DOCUMENT_UPLOADED'
                }
            });
            // 17.3 If document type is transfer_deed, trigger milestone
            if (document_type === 'transfer_deed') {
                await tx.milestones.create({
                    data: {
                        buyer_id: buyerId,
                        milestone_type: 'TRANSFER_DEED_UPLOADED'
                    }
                });
            }
            return document;
        });
    }
    static async listDocuments(buyerId) {
        return await db_1.prisma.documents.findMany({
            where: { buyer_id: buyerId },
            include: {
                versions: {
                    orderBy: { version_number: 'desc' }
                }
            }
        });
    }
    static async listVersions(documentId) {
        return await db_1.prisma.document_versions.findMany({
            where: { document_id: documentId },
            orderBy: { version_number: 'desc' }
        });
    }
}
exports.DocumentService = DocumentService;
