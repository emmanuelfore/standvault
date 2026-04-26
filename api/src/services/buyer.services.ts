import { prisma } from '../db';
import { PaymentStatus, StandStatus, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { supabaseAdmin, supabasePublic } from '../lib/supabase';
import { ScheduleService } from './schedule.services';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

export class BuyerService {
  private static async ensureBuyerPortalAccess(email: string, password = 'password123') {
    const normalizedEmail = email.toLowerCase();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (error) {
      throw { status: 500, message: `Unable to query Supabase Auth users: ${error.message}` };
    }

    const existingUser = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true
      });

      if (updateError) {
        throw { status: 500, message: `Unable to update user account: ${updateError.message}` };
      }

      return {
        email: normalizedEmail,
        mode: 'update',
        supabase_user_id: existingUser.id
      };
    }

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true
    });

    if (createError) {
      throw { status: 500, message: `Unable to create purchaser account: ${createError.message}` };
    }

    return {
      email: normalizedEmail,
      mode: 'create',
      supabase_user_id: createData.user?.id || null
    };
  }

  private static async deriveBuyerPaymentStatus(buyerId: string, stand: { size_sqm: any; price_per_sqm: any }, arrearsStatus: boolean) {
    const chargesAgg = await prisma.ledger_entries.aggregate({
      where: {
        buyer_id: buyerId,
        entry_type: { in: ['FEE', 'PENALTY'] }
      },
      _sum: { amount: true }
    });

    const paymentsAgg = await prisma.ledger_entries.aggregate({
      where: {
        buyer_id: buyerId,
        entry_type: 'PAYMENT',
        is_verified: true
      },
      _sum: { amount: true }
    });

    const reversalsAgg = await prisma.ledger_entries.aggregate({
      where: {
        buyer_id: buyerId,
        entry_type: 'REVERSAL',
        is_verified: true
      },
      _sum: { amount: true }
    });

    const standPrice = Number(stand.size_sqm) * Number(stand.price_per_sqm);
    const totalCharges = Number(chargesAgg._sum.amount || 0);
    const totalPayments = Number(paymentsAgg._sum.amount || 0) - Number(reversalsAgg._sum.amount || 0);
    const outstanding = Math.max(0, standPrice + totalCharges - totalPayments);

    if (outstanding <= 0) {
      return PaymentStatus.FULLY_PAID;
    }

    return arrearsStatus ? PaymentStatus.IN_ARREARS : PaymentStatus.CURRENT;
  }

  static async createBuyer(projectId: string, data: any) {
    const { 
      stand_id, first_name, last_name, email, id_number, phone_number, allocation_date,
      total_contract_price, payment_plan_months, monthly_instalment, deposit_amount, legacy_customer_code
    } = data;
    const normalizedEmail = email.toLowerCase();

    const currentConfig = await prisma.project_configs.findFirst({
      where: { project_id: projectId },
      orderBy: { version: 'desc' }
    });

    if (!currentConfig) throw { status: 400, message: 'Project has no active configuration' };

    const stand = await prisma.stands.findUnique({ where: { id: stand_id } });
    if (!stand || stand.project_id !== projectId || stand.status !== StandStatus.AVAILABLE) {
      throw { status: 400, message: 'Stand is not available or does not belong to this project' };
    }

    const existingBuyerForStand = await prisma.buyers.findFirst({
      where: { stand_id },
      include: { user: true }
    });

    if (existingBuyerForStand) {
      throw {
        status: 400,
        message: `Stand ${stand.stand_number} is already allocated to ${existingBuyerForStand.first_name} ${existingBuyerForStand.last_name}.`
      };
    }

    const bId = crypto.randomUUID();
    const existingUser = await prisma.users.findUnique({ where: { email: normalizedEmail } });

    if (existingUser && existingUser.role !== UserRole.BUYER) {
      throw { status: 400, message: 'This email already belongs to a non-buyer account.' };
    }

    if (existingUser) {
      const existingBuyerProfile = await prisma.buyers.findFirst({ where: { user_id: existingUser.id } });
      if (existingBuyerProfile) {
        throw { status: 400, message: 'A purchaser account already exists for this email address.' };
      }
    }

    const claimedStand = await prisma.stands.updateMany({
      where: {
        id: stand_id,
        project_id: projectId,
        status: StandStatus.AVAILABLE
      },
      data: { status: StandStatus.ALLOCATED }
    });

    if (claimedStand.count === 0) {
      throw { status: 400, message: 'Stand is not available or does not belong to this project' };
    }

    try {
      const buyer = await prisma.$transaction(async (tx) => {
        const duplicateBuyerForStand = await tx.buyers.findFirst({
          where: { stand_id }
        });

        if (duplicateBuyerForStand) {
          throw {
            status: 400,
            message: `Stand ${stand.stand_number} is already allocated and cannot be assigned twice.`
          };
        }

        let resolvedUser = existingUser;
        if (!resolvedUser) {
          const defaultPasswordHash = await bcrypt.hash('password123', 12);
          resolvedUser = await tx.users.create({
            data: {
              email: normalizedEmail,
              password_hash: defaultPasswordHash,
              role: UserRole.BUYER
            }
          });
        }

        return await tx.buyers.create({
          data: {
            id: bId,
            user_id: resolvedUser.id,
            stand_id,
            project_config_id: currentConfig.id,
            first_name,
            last_name,
            id_number,
            phone_number,
            allocation_date: allocation_date ? new Date(allocation_date) : new Date(),
            total_contract_price: total_contract_price ? new Prisma.Decimal(total_contract_price) : null,
            payment_plan_months: payment_plan_months ? parseInt(payment_plan_months) : null,
            monthly_instalment: monthly_instalment ? new Prisma.Decimal(monthly_instalment) : null,
            deposit_amount: deposit_amount ? new Prisma.Decimal(deposit_amount) : null,
            legacy_customer_code: legacy_customer_code || null
          }
        });
      });

      await this.ensureBuyerPortalAccess(normalizedEmail, 'password123');
      
      return buyer;
    } catch (error) {
      await prisma.stands.updateMany({
        where: {
          id: stand_id,
          project_id: projectId,
          status: StandStatus.ALLOCATED
        },
        data: { status: StandStatus.AVAILABLE }
      });

      throw error;
    }
  }


  static async listProjectBuyers(projectId: string, filters: any) {
    const { name, stand_number, payment_status, arrears_status } = filters;
    const where: any = { stand: { project_id: projectId } };
    
    if (name) {
      where.OR = [
        { first_name: { contains: name, mode: 'insensitive' } },
        { last_name: { contains: name, mode: 'insensitive' } }
      ];
    }
    if (stand_number) {
      where.stand = { ...where.stand, stand_number: { contains: stand_number } };
    }
    if (arrears_status !== undefined) {
      where.arrears_status = arrears_status === 'true' || arrears_status === true;
    }

    const buyers = await prisma.buyers.findMany({
      where,
      include: { stand: true, user: true }
    });

    const buyersWithDerivedStatus = await Promise.all(
      buyers.map(async (buyer) => ({
        ...buyer,
        payment_status: await this.deriveBuyerPaymentStatus(buyer.id, buyer.stand, buyer.arrears_status)
      }))
    );

    if (payment_status) {
      return buyersWithDerivedStatus.filter((buyer) => buyer.payment_status === payment_status);
    }

    return buyersWithDerivedStatus;
  }

  static async getBuyer(buyerId: string) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { 
        stand: {
          include: { project: true }
        }, 
        user: true, 
        config: true,
        schedules: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            periods: { orderBy: { period_number: 'asc' } }
          }
        }
      }
    });

    if (!buyer) {
      return null;
    }

    if (buyer.schedules?.length) {
      const computedSchedule = await ScheduleService.materializeSchedule(buyer.schedules[0], buyer.id);
      return {
        ...buyer,
        schedules: computedSchedule ? [computedSchedule] : buyer.schedules
      };
    }

    return buyer;
  }

  static async getDashboardData(buyerId: string) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { stand: true }
    });

    if (!buyer) throw { status: 404, message: 'Buyer not found' };

    const ledgerEntries = await prisma.ledger_entries.findMany({
      where: { buyer_id: buyerId },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    // Calculate actual outstanding: Sum(Charges/Penalties) - Sum(Payments)
    const chargesAgg = await prisma.ledger_entries.aggregate({
      where: { buyer_id: buyerId, entry_type: { in: ['FEE', 'PENALTY'] } },
      _sum: { amount: true }
    });
    const paymentsAgg = await prisma.ledger_entries.aggregate({
      where: { buyer_id: buyerId, entry_type: 'PAYMENT', is_verified: true },
      _sum: { amount: true }
    });

    const reversalsAgg = await prisma.ledger_entries.aggregate({
      where: { buyer_id: buyerId, entry_type: 'REVERSAL', is_verified: true },
      _sum: { amount: true }
    });

    const totalCharges = Number(chargesAgg._sum.amount || 0);
    const totalPayments = Number(paymentsAgg._sum.amount || 0) - Number(reversalsAgg._sum.amount || 0);
    const totalPaid = totalPayments;
    const totalPrice = Number(buyer.stand.size_sqm) * Number(buyer.stand.price_per_sqm);
    
    // Outstanding includes the original price + any additional charges - payments
    // Actually, in many systems, the "price" is just the initial charge. 
    // Let's assume the schedule handles the price.
    // If there's an active schedule, we should check it.
    
    const nextPayment = await prisma.instalment_periods.findFirst({
      where: { 
        schedule: { buyer_id: buyerId, status: 'ACTIVE' },
        due_date: { gte: new Date() }
      },
      orderBy: { due_date: 'asc' }
    });

    const progressPct = Math.round((totalPaid / totalPrice) * 100);

    return {
      stand_number: buyer.stand.stand_number,
      balance_status: buyer.arrears_status ? 'ARREARS' : 'HEALTHY',
      total_price: totalPrice,
      total_paid: totalPaid,
      outstanding: Math.max(0, (totalPrice + totalCharges) - totalPaid),
      progress_pct: progressPct,
      next_payment_date: nextPayment ? nextPayment.due_date.toISOString().split('T')[0] : 'N/A',
      next_payment_amount: nextPayment ? nextPayment.total_expected.toString() : '0.00',
      recent_activity: ledgerEntries
    };
  }

  static async updateBuyerDetails(buyerId: string, data: any) {
    const { 
      first_name, last_name, id_number, phone_number, allocation_date,
      total_contract_price, payment_plan_months, monthly_instalment, deposit_amount, legacy_customer_code
    } = data;
    
    return await prisma.buyers.update({
      where: { id: buyerId },
      data: {
        first_name,
        last_name,
        id_number,
        phone_number,
        allocation_date: allocation_date ? new Date(allocation_date) : undefined,
        total_contract_price: total_contract_price ? new Prisma.Decimal(total_contract_price) : undefined,
        payment_plan_months: payment_plan_months ? parseInt(payment_plan_months) : undefined,
        monthly_instalment: monthly_instalment ? new Prisma.Decimal(monthly_instalment) : undefined,
        deposit_amount: deposit_amount ? new Prisma.Decimal(deposit_amount) : undefined,
        legacy_customer_code: legacy_customer_code !== undefined ? legacy_customer_code : undefined
      }
    });
  }

  static async updateBuyerAccount(buyerId: string, data: { email?: string }) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { user: true }
    });

    if (!buyer) {
      throw { status: 404, message: 'Buyer not found' };
    }

    const nextEmail = data.email?.trim().toLowerCase();
    if (!nextEmail || nextEmail === buyer.user.email.toLowerCase()) {
      return buyer.user;
    }

    const existingUser = await prisma.users.findUnique({ where: { email: nextEmail } });
    if (existingUser && existingUser.id !== buyer.user_id) {
      throw { status: 400, message: 'That email address is already in use.' };
    }

    const { data: authUsers, error: authLookupError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (authLookupError) {
      throw { status: 500, message: `Unable to query Supabase Auth users: ${authLookupError.message}` };
    }

    const existingAuthUser = authUsers.users.find((user) => user.email?.toLowerCase() === buyer.user.email.toLowerCase());

    if (existingAuthUser) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
        email: nextEmail
      });

      if (updateAuthError) {
        throw { status: 500, message: `Unable to update Supabase account email: ${updateAuthError.message}` };
      }
    }

    return await prisma.users.update({
      where: { id: buyer.user_id },
      data: { email: nextEmail }
    });
  }

  static async listBuyerAccounts(projectId: string) {
    const buyers = await prisma.buyers.findMany({
      where: { stand: { project_id: projectId } },
      include: {
        user: true,
        stand: true
      },
      orderBy: [
        { first_name: 'asc' },
        { last_name: 'asc' }
      ]
    });

    let authUsers = new Map<string, any>();
    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

      if (error) {
        console.error('Unable to query Supabase Auth users for buyer accounts', error);
      } else {
        authUsers = new Map(
          (data?.users || [])
            .filter((user) => user.email)
            .map((user) => [user.email!.toLowerCase(), user])
        );
      }
    } catch (error) {
      console.error('Unexpected Supabase Auth lookup failure for buyer accounts', error);
    }

    return buyers.map((buyer) => {
      const authUser = authUsers.get(buyer.user.email.toLowerCase());
      return {
        buyer_id: buyer.id,
        purchaser_name: `${buyer.first_name} ${buyer.last_name}`,
        email: buyer.user.email,
        stand_number: buyer.stand?.stand_number || '',
        has_local_account: Boolean(buyer.user_id),
        has_supabase_account: Boolean(authUser),
        auth_status: authUser ? (authUser.last_sign_in_at ? 'ACTIVE' : 'INVITED') : 'NOT_PROVISIONED',
        last_sign_in_at: authUser?.last_sign_in_at || null,
        created_at: buyer.created_at,
        supabase_user_id: authUser?.id || null
      };
    });
  }

  static async sendBuyerAccessEmail(buyerId: string) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { user: true }
    });

    if (!buyer) {
      throw { status: 404, message: 'Buyer not found' };
    }

    return await this.ensureBuyerPortalAccess(buyer.user.email);
  }

  static async updateBuyerPassword(buyerId: string, newPassword: string) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { user: true }
    });

    if (!buyer) throw { status: 404, message: 'Buyer not found' };

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // 1. Update local database
    await prisma.users.update({
      where: { id: buyer.user_id },
      data: { password_hash: newPasswordHash, updated_at: new Date() }
    });

    // 2. Update Supabase Auth (if account exists)
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    
    const authUser = authData?.users.find(u => u.email?.toLowerCase() === buyer.user.email.toLowerCase());
    if (authUser) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
        email_confirm: true
      });
      if (error) console.error('Failed to update Supabase password:', error.message);
    }

    return { message: 'Password updated successfully' };
  }

  static async deletePurchaserAccount(buyerId: string) {
    const buyer = await prisma.buyers.findUnique({
      where: { id: buyerId },
      include: { user: true, stand: true }
    });

    if (!buyer) throw { status: 404, message: 'Buyer not found' };

    const userId = buyer.user_id;
    const standId = buyer.stand_id;
    const email = buyer.user.email;

    console.log(`Starting full deletion for buyer ${buyerId} (User: ${userId}, Email: ${email})`);

    await prisma.$transaction(async (tx) => {
      console.log('1. Deleting instalment periods...');
      await tx.instalment_periods.deleteMany({
        where: { schedule: { buyer_id: buyerId } }
      });

      console.log('2. Deleting instalment schedules...');
      await tx.instalment_schedules.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('3. Deleting document versions...');
      await tx.document_versions.deleteMany({
        where: { document: { buyer_id: buyerId } }
      });

      console.log('4. Deleting documents...');
      await tx.documents.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('5. Deleting pop submissions...');
      await tx.pop_submissions.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('6. Deleting ledger entries...');
      await tx.ledger_entries.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('7. Deleting milestones...');
      await tx.milestones.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('8. Deleting notifications...');
      await tx.notifications.deleteMany({
        where: { 
          OR: [
            { buyer_id: buyerId },
            { user_id: userId }
          ]
        }
      });

      console.log('9. Deleting penalty calculations...');
      await tx.penalty_calculations.deleteMany({
        where: { buyer_id: buyerId }
      });

      console.log('10. Cleaning up tokens and dissociated audit logs...');
      await tx.tokens.deleteMany({
        where: { user_id: userId }
      });

      await tx.audit_log.updateMany({
        where: { user_id: userId },
        data: { user_id: null }
      });

      await tx.project_admin_assignments.deleteMany({
        where: { user_id: userId }
      });

      console.log('11. Deleting buyer profile...');
      await tx.buyers.delete({
        where: { id: buyerId }
      });

      console.log('12. Deleting user account...');
      await tx.users.delete({
        where: { id: userId }
      });

      console.log('13. Reverting stand status...');
      await tx.stands.update({
        where: { id: standId },
        data: { status: StandStatus.AVAILABLE }
      });
    }, {
      timeout: 30000,
      maxWait: 5000
    });

    console.log('14. Syncing with Supabase Auth...');
    try {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      const authUser = authUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (authUser) {
        console.log(`Deleting Supabase user ${authUser.id}...`);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        if (error) console.error('Failed to delete Supabase user:', error.message);
      }
    } catch (err) {
      console.error('Unexpected error during Supabase sync:', err);
    }

    console.log('Deletion completed successfully.');
    return { message: 'Purchaser account and all associated records deleted successfully. Stand is now available.' };
  }
}
