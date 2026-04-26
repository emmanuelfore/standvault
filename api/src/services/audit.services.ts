import { prisma } from '../db';

export class AuditService {
  static async logChange(userId: string | null, action: string, entityType: string, entityId: string, details: any, ipAddress: string | null = null) {
    try {
      return await prisma.audit_log.create({
        data: {
          user_id: userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details,
          ip_address: ipAddress
        }
      });
    } catch (e) {
      console.error('Audit Log Error', e);
      // Suppress throwing to avoid breaking main transaction, or reconsider based on strictness.
      // Usually audit logs should be part of the transaction, but that requires passing `tx` down.
      // For MVP we just fire and forget if outside tx.
    }
  }

  static async getLogs(projectId: string, filters: any) {
    // For MVP, if we want project-filtered audit logs, we'd need to join to entities
    // But audit log is loosely coupled. A simpler way is filtering by details where relevant
    // or by entity if entity is project. The schema just has entity_type and entity_id.
    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.entity_type) where.entity_type = filters.entity_type;
    if (filters.user_id) where.user_id = filters.user_id;

    // Ideally if we want strictly project filtering, we'd add `project_id` to audit logs, but it's not in schema.
    // So we just return global logs matching filters (since it's typically SYSTEM_ADMIN viewing)
    return await prisma.audit_log.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
  }

  static async deleteLog() {
    // Should be rejected by trigger. Also blocked at API.
    throw { status: 409, message: 'Audit logs cannot be deleted or modified.' };
  }
}
