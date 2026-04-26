"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilestoneService = void 0;
const db_1 = require("../db");
const schedule_services_1 = require("./schedule.services");
const client_1 = require("@prisma/client");
const Decimal = client_1.Prisma.Decimal;
class MilestoneService {
    static async evaluatePaymentMilestones(buyerId) {
        const buyer = await db_1.prisma.buyers.findUnique({
            where: { id: buyerId },
            include: { config: true, stand: true }
        });
        if (!buyer || !buyer.config || !buyer.stand)
            return;
        const breakdown = await schedule_services_1.ScheduleService.getBalanceBreakdown(buyerId);
        if (!breakdown || breakdown.original_contract_value.equals(0))
            return;
        const totalPaid = breakdown.total_paid;
        const contractValue = breakdown.contract_value_with_charges; // Using value with charges or original? Usually milestones reflect against the total owed including charges for percentages.
        // Deposit
        const depositRequired = contractValue.mul(new Decimal(buyer.config.deposit_pct).div(100));
        const percentagePaid = totalPaid.div(contractValue).mul(100);
        const thresholds = [
            { type: 'DEPOSIT_CLEARED', condition: totalPaid.greaterThanOrEqualTo(depositRequired) },
            { type: '25_PERCENT_PAID', condition: percentagePaid.greaterThanOrEqualTo(25) },
            { type: '50_PERCENT_PAID', condition: percentagePaid.greaterThanOrEqualTo(50) },
            { type: '75_PERCENT_PAID', condition: percentagePaid.greaterThanOrEqualTo(75) },
            { type: '100_PERCENT_PAID', condition: percentagePaid.greaterThanOrEqualTo(100) }
        ];
        const currentMilestones = await db_1.prisma.milestones.findMany({
            where: { buyer_id: buyerId }
        });
        const existingTypes = new Set(currentMilestones.map(m => m.milestone_type));
        for (const threshold of thresholds) {
            if (threshold.condition && !existingTypes.has(threshold.type)) {
                // Trigger milestone
                await db_1.prisma.milestones.create({
                    data: {
                        buyer_id: buyerId,
                        milestone_type: threshold.type
                    }
                });
                // Enqueue notification for buyer
                await db_1.prisma.notifications.create({
                    data: {
                        buyer_id: buyerId,
                        title: 'Milestone Reached!',
                        message: `Congratulations! You have reached the ${threshold.type.replace(/_/g, ' ')} milestone.`,
                        type: 'MILESTONE_REACHED'
                    }
                });
                // Admin notification for 100%
                if (threshold.type === '100_PERCENT_PAID') {
                    const admins = await db_1.prisma.project_admin_assignments.findMany({
                        where: { project_id: buyer.stand.project_id }
                    });
                    await db_1.prisma.notifications.createMany({
                        data: admins.map(admin => ({
                            user_id: admin.user_id,
                            title: 'Buyer Fully Paid',
                            message: `Buyer ${buyer.first_name} ${buyer.last_name} (${buyer.stand.stand_number}) has reached 100% payment completion.`,
                            type: 'BUYER_FULLY_PAID'
                        }))
                    });
                }
            }
        }
    }
    static async getMilestones(buyerId) {
        return await db_1.prisma.milestones.findMany({
            where: { buyer_id: buyerId },
            orderBy: { achieved_at: 'asc' }
        });
    }
}
exports.MilestoneService = MilestoneService;
