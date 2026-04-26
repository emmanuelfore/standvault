import { prisma } from '../db';
import { ScheduleService } from './schedule.services';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

export class PenaltyService {
  static async calculatePenalty(buyerId: string) {
    const schedule = await ScheduleService.getSchedule(buyerId);
    if (!schedule) return null;

    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { config: true }
    });

    if (!buyer || !buyer.config) return null;

    const balance = await ScheduleService.getBalance(buyerId);
    
    const now = new Date();
    // Assuming 5 days grace period
    const gracePeriodMs = 5 * 24 * 60 * 60 * 1000;

    let hasOverduePastGrace = false;
    let periodOverdue = 0;
    
    for (const period of schedule.periods) {
      if (period.due_date > now) continue;
      
      const graceEnd = new Date(period.due_date.getTime() + gracePeriodMs);
      if (now > graceEnd && balance.arrearsAmount.greaterThan(0)) {
        hasOverduePastGrace = true;
        periodOverdue = period.period_number;
        break;
      }
    }

    if (!hasOverduePastGrace) {
      return { status: 'NO_PENALTY_APPLICABLE' };
    }

    const penaltyRate = new Decimal(buyer.config.penalty_rate).div(100);
    const penaltyAmount = balance.arrearsAmount.mul(penaltyRate);

    // Create a pending review calculation in penalty_calculations
    const calculation = await prisma.penalty_calculations.create({
       data: {
          buyer_id: buyerId,
          calculated_amount: penaltyAmount,
          period_overdue: periodOverdue,
          status: 'PENDING_REVIEW',
          reason: 'Automated Arrears Penalty'
       }
    });

    return calculation;
  }

  static async approvePenalty(calculationId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const calc = await tx.penalty_calculations.findUnique({ where: { id: calculationId } });
      if (!calc || calc.status !== 'PENDING_REVIEW') {
         throw { status: 404, message: 'Pending penalty calculation not found' };
      }

      await tx.penalty_calculations.update({
         where: { id: calculationId },
         data: { status: 'APPROVED' }
      });

      return await tx.ledger_entries.create({
         data: {
            buyer_id: calc.buyer_id,
            amount: calc.calculated_amount,
            entry_type: 'PENALTY',
            description: `Automated Arrears Penalty for Period ${calc.period_overdue}`,
            effective_date: new Date(),
            created_by: userId,
            is_verified: true
         }
      });
    });
  }
}
