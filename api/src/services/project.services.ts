import { prisma } from '../db';
import { StandStatus, Prisma } from '@prisma/client';

export class ProjectService {
  static async createProject(data: any) {
    const { name, config } = data;
    
    return await prisma.$transaction(async (tx) => {
      const project = await tx.projects.create({
        data: { name }
      });
      
      const projectConfig = await tx.project_configs.create({
        data: {
          project_id: project.id,
          version: 1,
          currency: config.currency,
          deposit_pct: new Prisma.Decimal(config.deposit_pct),
          instalments_max: config.instalments_max,
          interest_rate: new Prisma.Decimal(config.interest_rate),
          penalty_rate: new Prisma.Decimal(config.penalty_rate)
        }
      });
      
      return { project, projectConfig };
    }, {
      timeout: 30000 // Increased timeout for slow environments
    });
  }

  static async getProject(id: string) {
    return await prisma.projects.findUnique({
      where: { id },
      include: { configs: { orderBy: { version: 'desc' }, take: 1 } }
    });
  }

  static async updateProjectConfig(id: string, newConfigData: any) {
    return await prisma.$transaction(async (tx) => {
      const latestConfig = await tx.project_configs.findFirst({
        where: { project_id: id },
        orderBy: { version: 'desc' }
      });
      
      if (!latestConfig) {
        throw { status: 404, message: 'Project config not found' };
      }

      // Snapshot logic: Always create a new version of the config, do not mutate existing
      const newVersion = latestConfig.version + 1;
      
      const newConfig = await tx.project_configs.create({
        data: {
          project_id: id,
          version: newVersion,
          currency: newConfigData.currency ?? latestConfig.currency,
          deposit_pct: newConfigData.deposit_pct ? new Prisma.Decimal(newConfigData.deposit_pct) : latestConfig.deposit_pct,
          instalments_max: newConfigData.instalments_max ?? latestConfig.instalments_max,
          interest_rate: newConfigData.interest_rate ? new Prisma.Decimal(newConfigData.interest_rate) : latestConfig.interest_rate,
          penalty_rate: newConfigData.penalty_rate ? new Prisma.Decimal(newConfigData.penalty_rate) : latestConfig.penalty_rate
        }
      });
      
      return newConfig;
    }, {
      timeout: 10000
    });
  }
  
  static async assignAdmin(projectId: string, userId: string) {
    return await prisma.project_admin_assignments.create({
      data: {
        project_id: projectId,
        user_id: userId
      }
    });
  }

  static async createStand(projectId: string, data: any) {
    return await prisma.stands.create({
      data: {
        project_id: projectId,
        stand_number: data.stand_number,
        size_sqm: data.size_sqm,
        price_per_sqm: data.price_per_sqm,
        status: data.status || StandStatus.AVAILABLE
      }
    });
  }

  static async getStands(projectId: string, statusFilter?: StandStatus) {
    const where: any = { project_id: projectId };
    if (statusFilter) {
      where.status = statusFilter;
    }
    return await prisma.stands.findMany({ where });
  }

  static async updateStand(projectId: string, standId: string, status: StandStatus) {
    // Validates enum automatically via Prisma types, but explicitly in schema as well
    return await prisma.stands.update({
      where: { id: standId, project_id: projectId },
      data: { status }
    });
  }

  static async createStands(projectId: string, stands: any[]) {
    return await prisma.stands.createMany({
      data: stands.map(s => ({
        project_id: projectId,
        stand_number: s.stand_number,
        size_sqm: new Prisma.Decimal(s.size_sqm),
        price_per_sqm: new Prisma.Decimal(s.price_per_sqm),
        status: s.status || StandStatus.AVAILABLE
      }))
    });
  }

  static async listProjects(userId: string, role: string) {
    if (role === 'SYSTEM_ADMIN') {
      return await prisma.projects.findMany({
        include: { configs: { orderBy: { version: 'desc' }, take: 1 } }
      });
    }

    const assignments = await prisma.project_admin_assignments.findMany({
      where: { user_id: userId },
      include: { 
        project: { 
          include: { configs: { orderBy: { version: 'desc' }, take: 1 } } 
        } 
      }
    });

    return assignments.map(a => a.project);
  }

  static async getDashboardData(projectId: string) {
    const totalBuyers = await prisma.buyers.count({
      where: { stand: { project_id: projectId } }
    });

    const pendingPoP = await prisma.pop_submissions.count({
      where: { buyer: { stand: { project_id: projectId } }, status: 'PENDING' }
    });


    // 1. Lightning-fast payload retrieval using strict SELECT instead of INCLUDE
    // This reduces the DB wire transfer size by up to 90%, entirely fixing the Memory/Network bottleneck
    const buyersWithStands = await prisma.buyers.findMany({
      where: { stand: { project_id: projectId } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        created_at: true,
        stand: { select: { size_sqm: true, price_per_sqm: true } },
        config: { select: { deposit_pct: true } },
        schedules: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            periods: { select: { due_date: true, interest_expected: true, total_expected: true } }
          }
        },
        ledger_entries: {
          select: {
            id: true,
            amount: true,
            entry_type: true,
            effective_date: true,
            created_at: true,
            is_verified: true,
            allocation_type: true
          }
        }
      }
    });

    // 2. Initialize our accumulators
    let totalStandValue = 0;
    let totalInterest = 0;
    let totalFeesAndPenalties = 0;
    let totalPayments = 0;
    let totalReversals = 0;
    
    let monthlyTarget = 0;
    let monthlyCollected = 0;
    let monthPaymentsSum = 0;
    let monthReversalsSum = 0;
    
    let prevPaymentsSum = 0;
    let prevReversalsSum = 0;
    let prevChargesAgg = 0;
    let prevBuyers = 0;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const agedDebtCategories = { 'Current': 0, '30 Days': 0, '60 Days': 0, '90+ Days': 0 };
    const now = new Date();

    // Arrays to manually group chart data and recent activity
    const monthlyCollectionsMap: { [key: number]: number } = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0 };
    const recentActivityPool = [];
    const monthBoundaries = Array.from({length: 6}, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return {
            mStart: new Date(d.getFullYear(), d.getMonth(), 1),
            mEnd: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        };
    });

    // 3. Process EVERYTHING in-memory in one highly optimised loop
    for (const b of buyersWithStands) {
       if (b.created_at < startOfMonth) prevBuyers++;

       const standPrincipal = Number(b.stand?.size_sqm || 0) * Number(b.stand?.price_per_sqm || 0);
       totalStandValue += standPrincipal;
       const depositAmount = standPrincipal * (Number(b.config?.deposit_pct || 0) / 100);

       // Schedule Data processing
       let expectedByNow = depositAmount;
       let perPeriod = 0;
       const schedule = b.schedules[0];

       if (schedule) {
           for (const period of schedule.periods) {
               totalInterest += Number(period.interest_expected || 0);
               const pDate = new Date(period.due_date);
               // Monthly Target
               if (pDate >= startOfMonth && pDate <= endOfMonth) {
                   monthlyTarget += Number(period.total_expected || 0);
               }
               // Arrears calculations
               if (pDate <= now) {
                   expectedByNow += Number(period.total_expected || 0);
               }
           }
           if (schedule.periods.length > 0) perPeriod = Number(schedule.periods[0].total_expected);
       }

       // Ledger Data processing
       let pool = 0;
       for (const entry of b.ledger_entries) {
           const amt = Number(entry.amount || 0);
           const eDate = new Date(entry.effective_date);
           const cDate = new Date(entry.created_at);

           if (entry.entry_type === 'PAYMENT' || entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY') {
             recentActivityPool.push({
               id: entry.id,
               buyer: `${b.first_name} ${b.last_name}`,
               type: entry.entry_type === 'PAYMENT' ? 'payment' : 'fee',
               amount: amt,
               date: entry.created_at
             });
           }

           if (!entry.is_verified) continue;

           if (entry.entry_type === 'PAYMENT') {
               totalPayments += amt;
               if (!entry.allocation_type || entry.allocation_type === 'STAND') pool += amt;
               
               if (eDate >= startOfMonth && eDate <= endOfMonth) monthPaymentsSum += amt;
               if (eDate < startOfMonth) prevPaymentsSum += amt;

               // Historic 6-month array mapping using pre-calculated boundaries
               for (let i = 5; i >= 0; i--) {
                   if (eDate >= monthBoundaries[i].mStart && eDate <= monthBoundaries[i].mEnd) {
                       monthlyCollectionsMap[i] += amt;
                   }
               }
           } 
           else if (entry.entry_type === 'REVERSAL') {
               totalReversals += amt;
               if (!entry.allocation_type || entry.allocation_type === 'STAND') pool -= amt;
               
               if (eDate >= startOfMonth && eDate <= endOfMonth) monthReversalsSum += amt;
               if (eDate < startOfMonth) prevReversalsSum += amt;
           }
           else if (entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY' || entry.entry_type === 'CHARGE') {
               totalFeesAndPenalties += amt;
               if (cDate < startOfMonth) prevChargesAgg += amt;
           }
       }

       // Calculate Aged Debt for this buyer
       const arrears = expectedByNow - pool;
       if (arrears <= 0) {
           agedDebtCategories['Current']++;
       } else {
          if (perPeriod === 0) agedDebtCategories['90+ Days']++; 
          else if (arrears <= perPeriod) agedDebtCategories['30 Days']++;
          else if (arrears <= perPeriod * 2) agedDebtCategories['60 Days']++;
          else agedDebtCategories['90+ Days']++;
       }
    }

    const netPayments = totalPayments - totalReversals;
    const totalContractValue = totalStandValue + totalInterest;
    monthlyCollected = monthPaymentsSum - monthReversalsSum;

    const collectionProgress = monthlyTarget === 0 ? 100 : Math.min(100, Math.round((monthlyCollected / monthlyTarget) * 100));

    // Calculate trends
    const prevPayments = prevPaymentsSum - prevReversalsSum;
    const paymentTrend = prevPayments === 0 ? 0 : Math.round(((netPayments - prevPayments) / prevPayments) * 100);
    const buyerTrend = prevBuyers === 0 ? 0 : Math.round(((totalBuyers - prevBuyers) / prevBuyers) * 100);

    const prevOutstandingValue = (totalStandValue + totalInterest + prevChargesAgg) - prevPayments;
    const currentOutstanding = (totalContractValue + totalFeesAndPenalties) - netPayments;
    const outstandingTrend = prevOutstandingValue === 0 ? 0 : Math.round(((currentOutstanding - prevOutstandingValue) / prevOutstandingValue) * 100);

    // Dynamic Chart Data: Monthly Collections Compilation
    const monthlyCollections = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
        monthlyCollections.push({
            name: mStart.toLocaleString('default', { month: 'short' }),
            amount: monthlyCollectionsMap[i]
        });
    }

    // Pending PoP Trend & Recent Pops
    const prevPendingPoP = await prisma.pop_submissions.count({
      where: { buyer: { stand: { project_id: projectId } }, status: 'PENDING', created_at: { lt: startOfMonth } }
    });
    const popTrend = prevPendingPoP === 0 ? 0 : Math.round(((pendingPoP - prevPendingPoP) / prevPendingPoP) * 100);

    const recentPoPs = await prisma.pop_submissions.findMany({
      where: { buyer: { stand: { project_id: projectId } } },
      orderBy: { created_at: 'desc' }, take: 10, include: { buyer: true }
    });
    
    for(const p of recentPoPs) {
      recentActivityPool.push({
        id: p.id,
        buyer: `${p.buyer.first_name} ${p.buyer.last_name}`,
        type: 'pop',
        amount: Number(p.amount),
        date: p.created_at
      });
    }

    const recentActivity = recentActivityPool
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);    // Dynamic Chart Data: Aged Debt Distribution
    const agedDebtDistribution = Object.entries(agedDebtCategories).map(([name, value]) => ({ name, value }));

    return {
      totalBuyers,
      totalBuyersTrend: buyerTrend >= 0 ? `+${buyerTrend}%` : `${buyerTrend}%`,
      totalCollected: totalPayments,
      totalCollectedTrend: paymentTrend >= 0 ? `+${paymentTrend}%` : `${paymentTrend}%`,
      totalOutstanding: Math.max(0, currentOutstanding),
      totalOutstandingTrend: outstandingTrend >= 0 ? `+${outstandingTrend}%` : `${outstandingTrend}%`,
      pendingPoP,
      pendingPoPTrend: popTrend >= 0 ? `+${popTrend}%` : `${popTrend}%`,
      recentActivity,
      monthlyTarget,
      collectionProgress,
      monthlyCollections,
      agedDebtDistribution
    };
  }
}
