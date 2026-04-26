import { prisma } from '../db';
import { ReconciliationService } from './reconciliation.services';
import { ScheduleService } from './schedule.services';

export class LedgerService {
  static async addPayment(buyerId: string, data: any, userId?: string) {
    const { amount, description, effective_date, file_url } = data;

    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { stand: true }
    });

    let requiresApproval = false;
    let warning = null;

    if (buyer) {
      const isBackdated = await ReconciliationService.isBackdatedClosed(buyer.stand.project_id, new Date(effective_date));
      if (isBackdated) {
        requiresApproval = true;
        warning = 'Warning: Effective date falls within a closed reconciliation period. Approval required.';
      }
    }

    const entry = await prisma.ledger_entries.create({
      data: {
        buyer: { connect: { id: buyerId } },
        amount,
        entry_type: 'PAYMENT',
        description: description || 'Payment received',
        effective_date: new Date(effective_date),
        is_verified: !requiresApproval,
        allocation_type: data.allocation_type || 'STAND',
        allocation_target_id: data.allocation_target_id,
        ...(userId && { creator: { connect: { id: userId } } })
      }
    });

    if (file_url) {
      await prisma.pop_submissions.create({
        data: {
          buyer_id: buyerId,
          file_url,
          amount,
          payment_date: new Date(effective_date),
          status: 'APPROVED',
          ledger_entry_id: entry.id
        }
      });
    }

    if (!requiresApproval) {
      // Evaluate milestones on verified payment
      import('./milestone.services').then(m => m.MilestoneService.evaluatePaymentMilestones(buyerId));
      await ScheduleService.recalculateAllocations(buyerId);
    }

    return { entry, requires_approval: requiresApproval, warning };
  }

  static async listProjectPayments(projectId: string, filters: any) {
    const { name, stand_number, start_date, end_date } = filters;

    const where: any = {
      entry_type: 'PAYMENT',
      buyer: {
        stand: { project_id: projectId }
      }
    };

    if (name) {
      where.buyer = {
        ...where.buyer,
        OR: [
          { first_name: { contains: name, mode: 'insensitive' } },
          { last_name: { contains: name, mode: 'insensitive' } }
        ]
      };
    }

    if (stand_number) {
      where.buyer = {
        ...where.buyer,
        stand: {
          ...where.buyer.stand,
          stand_number: { contains: stand_number, mode: 'insensitive' }
        }
      };
    }

    if (start_date || end_date) {
      where.effective_date = {};
      if (start_date) where.effective_date.gte = new Date(start_date);
      if (end_date) where.effective_date.lte = new Date(end_date);
    }

    return await prisma.ledger_entries.findMany({
      where,
      orderBy: { effective_date: 'desc' },
      include: {
        buyer: {
          include: {
            stand: true,
            user: true
          }
        },
        pop_submissions: true,
        creator: true
      }
    });
  }

  static async listProjectCharges(projectId: string, filters: any) {
    const { name, stand_number, start_date, end_date } = filters;

    const where: any = {
      entry_type: { in: ['FEE', 'PENALTY'] },
      buyer: {
        stand: { project_id: projectId }
      }
    };

    if (name) {
      where.buyer = {
        ...where.buyer,
        OR: [
          { first_name: { contains: name, mode: 'insensitive' } },
          { last_name: { contains: name, mode: 'insensitive' } }
        ]
      };
    }

    if (stand_number) {
      where.buyer = {
        ...where.buyer,
        stand: {
          ...where.buyer.stand,
          stand_number: { contains: stand_number, mode: 'insensitive' }
        }
      };
    }

    if (start_date || end_date) {
      where.effective_date = {};
      if (start_date) where.effective_date.gte = new Date(start_date);
      if (end_date) where.effective_date.lte = new Date(end_date);
    }

    return await prisma.ledger_entries.findMany({
      where,
      orderBy: { effective_date: 'desc' },
      include: {
        buyer: {
          include: {
            stand: true,
            user: true
          }
        },
        creator: true
      }
    });
  }

  static async getLedger(buyerId: string) {
    return await prisma.ledger_entries.findMany({
      where: { buyer_id: buyerId },
      orderBy: { effective_date: 'asc' },
      include: { pop_submissions: true }
    });
  }

  static async addReversal(buyerId: string, data: any, userId: string) {
    const { amount, description, effective_date, reverses_id } = data;

    if (!description || description.trim() === '') {
      throw { status: 400, message: 'Reversal reason/description cannot be empty' };
    }

    // Ensure the entry to reverse exists
    const entryToReverse = await prisma.ledger_entries.findUnique({ where: { id: reverses_id } });
    if (!entryToReverse) {
      throw { status: 404, message: 'Ledger entry to reverse not found' };
    }

    const entry = await prisma.ledger_entries.create({
      data: {
        buyer: { connect: { id: buyerId } },
        amount: amount,
        entry_type: 'REVERSAL',
        description,
        effective_date: new Date(effective_date),
        is_verified: true,
        reverses_id,
        ...(userId && { creator: { connect: { id: userId } } })
      }
    });

    await ScheduleService.recalculateAllocations(buyerId);
    return entry;
  }

  static async addCharge(buyerId: string, data: any, userId: string) {
    const { amount, description, effective_date } = data;

    const entry = await prisma.ledger_entries.create({
      data: {
        buyer: { connect: { id: buyerId } },
        amount,
        entry_type: 'FEE',
        description: description || 'Additional Fee',
        effective_date: new Date(effective_date),
        is_verified: true,
        ...(userId && { creator: { connect: { id: userId } } })
      }
    });

    await prisma.notifications.create({
      data: {
        buyer_id: buyerId,
        title: 'New Fee Added',
        message: `A new fee of ${amount} was added to your ledger: ${description}`,
        type: 'FEE_ADDED'
      }
    });

    return entry;
  }

  static async addBulkCharge(projectId: string, data: any, userId: string) {
    const { amount, description, effective_date } = data;

    const activeBuyers = await prisma.buyers.findMany({
      where: { stand: { project_id: projectId } }
    });

    if (activeBuyers.length > 0) {
      await prisma.ledger_entries.createMany({
        data: activeBuyers.map((buyer) => ({
          buyer_id: buyer.id,
          amount,
          entry_type: 'FEE',
          description: description || 'Bulk Additional Fee',
          effective_date: new Date(effective_date),
          created_by: userId,
          is_verified: true
        }))
      });

      await prisma.notifications.createMany({
        data: activeBuyers.map((buyer) => ({
          buyer_id: buyer.id,
          title: 'New Fee Added',
          message: `A new fee of ${amount} was added to your ledger: ${description}`,
          type: 'FEE_ADDED'
        }))
      });
    }

    return { count: activeBuyers.length };
  }

  static async deletePayment() {
    // 9.7 Enforce verified payment deletion rejection at API layer (return 409)
    throw { status: 409, message: 'Verified ledger entries cannot be deleted. Use a Reversal instead.' };
  }
}
