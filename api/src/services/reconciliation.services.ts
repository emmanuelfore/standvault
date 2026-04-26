import { prisma } from '../db';
import { PopStatus } from '@prisma/client';

export class ReconciliationService {
  static async openPeriod(projectId: string, startDate: Date, endDate: Date) {
    return await prisma.reconciliation_periods.create({
      data: {
        project_id: projectId,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        is_closed: false
      }
    });
  }

  static async listPeriods(projectId: string) {
    return await prisma.reconciliation_periods.findMany({
      where: { project_id: projectId },
      orderBy: { start_date: 'desc' }
    });
  }

  static async closePeriod(periodId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const period = await tx.reconciliation_periods.findUnique({
        where: { id: periodId }
      });
      if (!period) throw { status: 404, message: 'Period not found' };
      if (period.is_closed) throw { status: 400, message: 'Period already closed' };

      // 15.1 Enforce close is rejected when pending PoPs exist
      const pendingPops = await tx.pop_submissions.count({
        where: {
          status: PopStatus.PENDING,
          buyer: { stand: { project_id: period.project_id } },
          payment_date: {
            gte: period.start_date,
            lte: period.end_date
          }
        }
      });

      if (pendingPops > 0) {
        throw { status: 409, message: 'Cannot close reconciliation period with pending Proof of Payments' };
      }

      return await tx.reconciliation_periods.update({
        where: { id: periodId },
        data: {
          is_closed: true,
          closed_at: new Date(),
          closed_by: userId
        }
      });
    });
  }

  static async isBackdatedClosed(projectId: string, effectiveDate: Date) {
     const date = new Date(effectiveDate);
     const closedPeriods = await prisma.reconciliation_periods.findFirst({
        where: {
           project_id: projectId,
           is_closed: true,
           start_date: { lte: date },
           end_date: { gte: date }
        }
     });

     return !!closedPeriods;
  }
}
