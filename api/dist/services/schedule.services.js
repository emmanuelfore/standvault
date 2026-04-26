"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleService = void 0;
const db_1 = require("../db");
const client_1 = require("@prisma/client");
const Decimal = client_1.Prisma.Decimal;
class ScheduleService {
    static async findPrimarySchedule(buyerId, txContext) {
        const tx = txContext || db_1.prisma;
        const activeSchedule = await tx.instalment_schedules.findFirst({
            where: { buyer_id: buyerId, status: client_1.ScheduleStatus.ACTIVE },
            include: { periods: { orderBy: { period_number: 'asc' } } }
        });
        if (activeSchedule) {
            return activeSchedule;
        }
        return await tx.instalment_schedules.findFirst({
            where: { buyer_id: buyerId },
            include: { periods: { orderBy: { period_number: 'asc' } } },
            orderBy: { created_at: 'desc' }
        });
    }
    static isDepositPayment(entry) {
        return (entry.entry_type === 'PAYMENT' &&
            String(entry.description || '').toLowerCase().includes('initial deposit'));
    }
    static calculateScheduleData(config, stand, options = {}) {
        const { startDate = new Date(), customInstalments, customDepositAmount } = options;
        const principal = new Decimal(stand.size_sqm).mul(stand.price_per_sqm);
        const depositAmount = customDepositAmount || principal.mul(config.deposit_pct).div(100);
        const amountToFinance = principal.sub(depositAmount);
        const numberOfInstalments = customInstalments || config.instalments_max;
        const interestRateDec = new Decimal(config.interest_rate).div(100);
        const totalInterest = amountToFinance.mul(interestRateDec);
        const principalPerPeriod = amountToFinance.div(numberOfInstalments);
        const interestPerPeriod = totalInterest.div(numberOfInstalments);
        const periods = [];
        let currentDate = new Date(startDate);
        for (let i = 1; i <= numberOfInstalments; i++) {
            const periodDate = new Date(currentDate);
            periods.push({
                period_number: i,
                due_date: periodDate,
                principal_expected: principalPerPeriod,
                interest_expected: interestPerPeriod,
                total_expected: principalPerPeriod.add(interestPerPeriod)
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return {
            principal,
            depositAmount,
            amountToFinance,
            totalInterest,
            periods
        };
    }
    static allocatePeriodsFromLedger(periods, ledgerEntries) {
        let pool = new Decimal(0);
        for (const entry of ledgerEntries) {
            const isStandAllocated = !entry.allocation_type || entry.allocation_type === 'STAND';
            if (entry.entry_type === 'PAYMENT' && !this.isDepositPayment(entry) && isStandAllocated) {
                pool = pool.add(entry.amount);
            }
            else if (entry.entry_type === 'REVERSAL') {
                pool = pool.sub(entry.amount);
            }
        }
        let remainingPool = pool;
        return periods.map((period) => {
            let allocated = new Decimal(0);
            let status = 'UNPAID';
            if (remainingPool.greaterThanOrEqualTo(period.total_expected)) {
                allocated = period.total_expected;
                remainingPool = remainingPool.sub(period.total_expected);
                status = 'PAID';
            }
            else if (remainingPool.greaterThan(0)) {
                allocated = remainingPool;
                remainingPool = new Decimal(0);
                status = 'PARTIAL';
            }
            return {
                ...period,
                paid_amount: allocated,
                status
            };
        });
    }
    static async materializeSchedule(schedule, buyerId) {
        if (!schedule) {
            return null;
        }
        const ledgerEntries = await db_1.prisma.ledger_entries.findMany({
            where: {
                buyer_id: buyerId,
                is_verified: true,
                entry_type: { in: ['PAYMENT', 'REVERSAL'] },
                OR: [
                    { allocation_type: 'STAND' },
                    { allocation_type: null }
                ]
            },
            orderBy: { effective_date: 'asc' }
        });
        return {
            ...schedule,
            periods: this.allocatePeriodsFromLedger(schedule.periods || [], ledgerEntries)
        };
    }
    static async generateSchedule(buyerId, projectConfigId, standId, options = {}, txContext) {
        const tx = txContext || db_1.prisma;
        const buyer = await tx.buyers.findUnique({ where: { id: buyerId } });
        if (!buyer)
            throw { status: 404, message: `Buyer with ID ${buyerId} not found` };
        const config = await tx.project_configs.findFirst({
            where: { id: projectConfigId },
            orderBy: { version: 'desc' }
        });
        const stand = await tx.stands.findUnique({ where: { id: standId } });
        if (!config || !stand)
            throw new Error('Missing config or stand');
        const { periods } = this.calculateScheduleData(config, stand, options);
        // Create Schedule
        const schedule = await tx.instalment_schedules.create({
            data: {
                buyer_id: buyerId,
                version: 1,
                status: client_1.ScheduleStatus.ACTIVE,
                periods: {
                    create: periods.map(p => ({
                        period_number: p.period_number,
                        due_date: p.due_date,
                        principal_expected: p.principal_expected,
                        interest_expected: p.interest_expected,
                        total_expected: p.total_expected
                    }))
                }
            }
        });
        // Automatically record the deposit as PAID if it hasn't been recorded yet
        const { depositAmount } = this.calculateScheduleData(config, stand, options);
        if (depositAmount.greaterThan(0)) {
            await tx.ledger_entries.create({
                data: {
                    buyer_id: buyerId,
                    amount: depositAmount,
                    entry_type: 'PAYMENT',
                    description: 'Initial Deposit (Auto-recorded on plan generation)',
                    effective_date: options.depositDate || new Date(),
                    is_verified: true
                }
            });
        }
        // Trigger initial allocation
        await this.recalculateAllocations(buyerId, tx);
        return schedule;
    }
    static async getSchedule(buyerId) {
        const existingSchedule = await this.findPrimarySchedule(buyerId);
        if (!existingSchedule) {
            return null;
        }
        try {
            await this.recalculateAllocations(buyerId);
            const refreshedSchedule = await this.findPrimarySchedule(buyerId);
            if (!refreshedSchedule) {
                return null;
            }
            return await this.materializeSchedule(refreshedSchedule, buyerId);
        }
        catch (error) {
            console.error('Failed to recalculate schedule allocations, returning existing schedule', error);
            return await this.materializeSchedule(existingSchedule, buyerId);
        }
    }
    static async getBalance(buyerId) {
        // Computed from ledger sum vs schedule
        const schedule = await this.getSchedule(buyerId);
        // Sum ledger entries
        const ledgers = await db_1.prisma.ledger_entries.findMany({
            where: { buyer_id: buyerId, is_verified: true }
        });
        let totalPaid = new Decimal(0);
        for (const entry of ledgers) {
            if (entry.entry_type === 'PAYMENT' && (!entry.allocation_type || entry.allocation_type === 'STAND')) {
                totalPaid = totalPaid.add(entry.amount);
            }
            else if (entry.entry_type === 'REVERSAL') {
                totalPaid = totalPaid.sub(entry.amount);
            }
        }
        let expectedByNow = new Decimal(0);
        const now = new Date();
        if (schedule) {
            // All schedules start with the deposit requirement
            const standPrincipal = new Decimal(schedule.buyer?.stand?.size_sqm || 0).mul(schedule.buyer?.stand?.price_per_sqm || 0);
            const config = schedule.buyer?.config || {};
            const depositAmount = standPrincipal.mul(config.deposit_pct || 0).div(100);
            expectedByNow = expectedByNow.add(depositAmount);
            for (const period of schedule.periods) {
                if (period.due_date <= now) {
                    expectedByNow = expectedByNow.add(period.total_expected);
                }
            }
        }
        const arrears = expectedByNow.sub(totalPaid);
        const inArrears = arrears.greaterThan(0);
        return {
            totalPaid,
            expectedToDate: expectedByNow,
            arrearsAmount: arrears.greaterThan(0) ? arrears : new Decimal(0),
            isInArrears: inArrears
        };
    }
    static async getBalanceBreakdown(buyerId) {
        const schedule = await this.getSchedule(buyerId);
        const ledgers = await db_1.prisma.ledger_entries.findMany({
            where: { buyer_id: buyerId, is_verified: true }
        });
        let totalPaid = new Decimal(0);
        let totalAdditionalCharges = new Decimal(0);
        for (const entry of ledgers) {
            const isStandAllocated = !entry.allocation_type || entry.allocation_type === 'STAND';
            if (entry.entry_type === 'PAYMENT') {
                totalPaid = totalPaid.add(entry.amount);
            }
            else if (entry.entry_type === 'REVERSAL') {
                totalPaid = totalPaid.sub(entry.amount);
            }
            else if (entry.entry_type === 'FEE' || entry.entry_type === 'PENALTY') {
                totalAdditionalCharges = totalAdditionalCharges.add(entry.amount);
            }
        }
        let originalContractValue = new Decimal(0);
        if (schedule && schedule.periods) {
            // 1. Principal + Total Interest
            const standPrincipal = new Decimal(schedule.buyer?.stand?.size_sqm || 0).mul(schedule.buyer?.stand?.price_per_sqm || 0);
            const totalInterest = schedule.periods.reduce((acc, p) => acc.add(p.interest_expected || 0), new Decimal(0));
            originalContractValue = standPrincipal.add(totalInterest);
        }
        const remainingBalance = originalContractValue.add(totalAdditionalCharges).sub(totalPaid);
        const contractValueWithCharges = originalContractValue.add(totalAdditionalCharges);
        return {
            original_contract_value: originalContractValue,
            total_additional_charges: totalAdditionalCharges,
            contract_value_with_charges: contractValueWithCharges,
            total_paid: totalPaid,
            remaining_balance: remainingBalance
        };
    }
    static async initializeSchedule(buyerId, options = {}) {
        // Convert number to Decimal if passed
        const normalizedOptions = {
            ...options,
            customDepositAmount: options.customDepositAmount !== undefined && typeof options.customDepositAmount === 'number'
                ? new Decimal(options.customDepositAmount)
                : options.customDepositAmount
        };
        const buyer = await db_1.prisma.buyers.findUnique({
            where: { id: buyerId },
            include: {
                stand: true,
                config: true,
                schedules: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            }
        });
        if (!buyer)
            throw { status: 404, message: 'Buyer not found' };
        if (buyer.schedules.length > 0) {
            return buyer.schedules[0];
        }
        return await this.generateSchedule(buyerId, buyer.project_config_id, buyer.stand_id, normalizedOptions);
    }
    static async recalculateAllocations(buyerId, txContext) {
        const tx = txContext || db_1.prisma;
        // 1. Calculate total verified payment pool (Payments - Reversals)
        const ledgerAgg = await tx.ledger_entries.findMany({
            where: { buyer_id: buyerId, is_verified: true, entry_type: { in: ['PAYMENT', 'REVERSAL'] } }
        });
        let pool = new Decimal(0);
        for (const entry of ledgerAgg) {
            const isStandAllocated = !entry.allocation_type || entry.allocation_type === 'STAND';
            if (entry.entry_type === 'PAYMENT' && isStandAllocated) {
                pool = pool.add(entry.amount);
            }
            else if (entry.entry_type === 'REVERSAL') {
                pool = pool.sub(entry.amount);
            }
        }
        // 2. Fetch periods in order
        const schedule = await tx.instalment_schedules.findFirst({
            where: { buyer_id: buyerId, status: client_1.ScheduleStatus.ACTIVE },
            include: { periods: { orderBy: { period_number: 'asc' } } }
        });
        if (!schedule)
            return;
        // 3. Sequential Allocation
        // The pool now includes the deposit. We need to "subtract" the deposit from the pool
        // before allocating to instalments, because the instalments total Principal - Deposit + Interest.
        const standPrincipal = new Decimal(schedule.buyer?.stand?.size_sqm || 0).mul(schedule.buyer?.stand?.price_per_sqm || 0);
        const config = schedule.buyer?.config || {};
        const depositRequired = standPrincipal.mul(config.deposit_pct || 0).div(100);
        let remainingPool = pool.sub(depositRequired); // Pool available for instalments
        let expectedToDate = new Decimal(0);
        const now = new Date();
        for (const period of schedule.periods) {
            let allocated = new Decimal(0);
            let status = 'UNPAID';
            if (remainingPool.greaterThanOrEqualTo(period.total_expected)) {
                allocated = period.total_expected;
                remainingPool = remainingPool.sub(period.total_expected);
                status = 'PAID';
            }
            else if (remainingPool.greaterThan(0)) {
                allocated = remainingPool;
                remainingPool = new Decimal(0);
                status = 'PARTIAL';
            }
            // Track if we are hitting arrears based on date
            if (period.due_date <= now) {
                expectedToDate = expectedToDate.add(period.total_expected);
            }
            await tx.instalment_periods.update({
                where: { id: period.id },
                data: {
                    paid_amount: allocated,
                    status
                }
            });
        }
        // 4. Update Buyer Status (CURRENT vs IN_ARREARS vs FULLY_PAID)
        const arrearsAmount = expectedToDate.sub(pool);
        const totalContractValue = schedule.periods.reduce((acc, p) => acc.add(p.total_expected), new Decimal(0));
        let buyersPaymentStatus = 'CURRENT';
        if (pool.greaterThanOrEqualTo(totalContractValue)) {
            buyersPaymentStatus = 'FULLY_PAID';
        }
        else if (arrearsAmount.greaterThan(0)) {
            buyersPaymentStatus = 'IN_ARREARS';
        }
        await tx.buyers.update({
            where: { id: buyerId },
            data: {
                payment_status: buyersPaymentStatus,
                arrears_status: arrearsAmount.greaterThan(0)
            }
        });
        return { pool, arrearsAmount, buyersPaymentStatus };
    }
}
exports.ScheduleService = ScheduleService;
