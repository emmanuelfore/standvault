import { prisma } from '../db';

export class NotificationService {
  static async getNotifications(buyerId: string) {
    return await prisma.notifications.findMany({
      where: { buyer_id: buyerId },
      orderBy: { created_at: 'desc' }
    });
  }

  static async markAsRead(notificationId: string, buyerId: string) {
    const notif = await prisma.notifications.findUnique({ where: { id: notificationId } });
    if (!notif || notif.buyer_id !== buyerId) {
      throw { status: 404, message: 'Notification not found' };
    }

    return await prisma.notifications.update({
      where: { id: notificationId },
      data: { is_read: true }
    });
  }

  static async getProjectAnnouncements(projectId: string) {
    // We want only unique announcements (not one for every buyer)
    // Or we can just return all and distinct by title/message/created_at
    // But broadcastAnnouncement creates many individual notifications.
    // Let's return unique ones based on their content and project.
    return await prisma.notifications.findMany({
      where: {
        type: 'ANNOUNCEMENT',
        buyer: {
          stand: { project_id: projectId }
        }
      },
      distinct: ['title', 'message', 'created_at'],
      orderBy: { created_at: 'desc' }
    });
  }

  static async broadcastAnnouncement(projectId: string, data: any, userId: string) {
    const { title, message, buyerIds } = data; // buyerIds is optional subset

    return await prisma.$transaction(async (tx) => {
      let targets = [];
      if (buyerIds && buyerIds.length > 0) {
        targets = await tx.buyers.findMany({
          where: { id: { in: buyerIds }, stand: { project_id: projectId } }
        });
      } else {
        targets = await tx.buyers.findMany({
          where: { stand: { project_id: projectId } }
        });
      }

      const notifications = targets.map((b) => ({
        buyer_id: b.id,
        user_id: userId,
        title,
        message,
        type: 'ANNOUNCEMENT'
      }));

      if (notifications.length > 0) {
        await tx.notifications.createMany({ data: notifications });
      }

      return { broadcastCount: notifications.length };
    });
  }
}
