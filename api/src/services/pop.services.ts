import { prisma } from '../db';
import { PopStatus } from '@prisma/client';
import { ScheduleService } from './schedule.services';

export class PopService {
  static async submitPop(buyerId: string, data: any) {
    const { amount, payment_date, file_url } = data;

    return await prisma.pop_submissions.create({
      data: {
        buyer_id: buyerId,
        amount,
        payment_date: new Date(payment_date),
        file_url,
        status: PopStatus.PENDING
      }
    });
  }

  static async listQueue(projectId: string) {
    const submissions = await prisma.pop_submissions.findMany({
      where: {
        status: PopStatus.PENDING,
        buyer: { stand: { project_id: projectId } }
      },
      include: { 
        buyer: {
          include: { 
            stand: true, 
            user: true,
            pop_submissions: {
               where: { status: PopStatus.REJECTED },
               select: { id: true }
            }
          }
        }
      }
    });

    return submissions.map(sub => ({
       ...sub,
       rejection_count: sub.buyer.pop_submissions.length
    }));
  }

  static async approvePop(submissionId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.pop_submissions.findUnique({ where: { id: submissionId } });
      if (!submission) throw { status: 404, message: 'Submission not found' };
      if (submission.status !== PopStatus.PENDING) throw { status: 400, message: 'Only PENDING submissions can be approved' };

      const ledgerEntry = await tx.ledger_entries.create({
        data: {
          buyer_id: submission.buyer_id,
          amount: submission.amount,
          entry_type: 'PAYMENT',
          description: 'Proof of Payment Approved',
          effective_date: submission.payment_date,
          created_by: userId,
          is_verified: true
        }
      });

      const pop = await tx.pop_submissions.update({
        where: { id: submissionId },
        data: {
          status: PopStatus.APPROVED,
          ledger_entry_id: ledgerEntry.id
        }
      });

      const notif = await tx.notifications.create({
        data: {
          buyer_id: pop.buyer_id,
          title: 'Proof of Payment Approved',
          message: `Your payment of ${pop.amount} has been verified and added to your ledger.`,
          type: 'POP_APPROVED'
        }
      });

      // Evaluate milestones upon approval
      import('./milestone.services').then(m => m.MilestoneService.evaluatePaymentMilestones(pop.buyer_id));
      
      await ScheduleService.recalculateAllocations(pop.buyer_id, tx);

      const buyer = await tx.buyers.findUnique({
        where: { id: pop.buyer_id },
        include: { stand: true, user: true }
      });

      return { approved: pop, ledgerEntry, notif, buyer };
    });
  }

  static async rejectPop(submissionId: string, reason: string) {
    return await prisma.$transaction(async (tx) => {
      const submission = await tx.pop_submissions.findUnique({ where: { id: submissionId } });
      if (!submission) throw { status: 404, message: 'Submission not found' };
      if (submission.status !== PopStatus.PENDING) throw { status: 400, message: 'Only PENDING submissions can be rejected' };

      const updated = await tx.pop_submissions.update({
        where: { id: submissionId },
        data: {
          status: PopStatus.REJECTED,
          rejection_reason: reason
        }
      });

      // Enqueue notification
      await tx.notifications.create({
        data: {
          buyer_id: submission.buyer_id,
          title: 'Proof of Payment Rejected',
          message: `Your PoP was rejected: ${reason}`,
          type: 'POP_REJECTED'
        }
      });

      return updated;
    });
  }
}
