"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const db_1 = require("../db");
const schedule_services_1 = require("./schedule.services");
const sync_1 = require("csv-stringify/sync");
const xlsx = __importStar(require("xlsx"));
const pdfkit_1 = __importDefault(require("pdfkit"));
class ReportService {
    static async getNotice(projectId) {
        const closed = await db_1.prisma.reconciliation_periods.findFirst({
            where: { project_id: projectId, is_closed: false }
        });
        return closed ? 'PROVISIONAL DATA: An open reconciliation period exists.' : null;
    }
    static async generateReport(type, projectId, format, res, query = {}) {
        const notice = await this.getNotice(projectId);
        const startDate = query.startDate ? new Date(query.startDate) : new Date(0);
        const endDate = query.endDate ? new Date(query.endDate) : new Date();
        const status = query.status !== 'ALL' ? query.status : null;
        // Abstracting report data fetching
        let headers = [];
        let rows = [];
        let title = '';
        if (type === 'defaulters') {
            title = 'Defaulters List';
            headers = ['Buyer ID', 'Name', 'Stand', 'Arrears Balance'];
            const buyers = await db_1.prisma.buyers.findMany({
                where: {
                    stand: { project_id: projectId },
                    arrears_status: true,
                    created_at: { gte: startDate, lte: endDate }
                },
                include: { stand: true }
            });
            for (const b of buyers) {
                const breakdown = await schedule_services_1.ScheduleService.getBalance(b.id);
                if (breakdown.arrearsAmount.greaterThan(0)) {
                    rows.push([b.id, `${b.first_name} ${b.last_name}`, b.stand.stand_number, breakdown.arrearsAmount.toString()]);
                }
            }
        }
        else if (type === 'collection_summary') {
            title = 'Collection Summary';
            headers = ['Buyer ID', 'Name', 'Total Expected', 'Total Paid', 'Outstanding'];
            const buyers = await db_1.prisma.buyers.findMany({
                where: { stand: { project_id: projectId } },
                include: { stand: true }
            });
            for (const b of buyers) {
                const bd = await schedule_services_1.ScheduleService.getBalanceBreakdown(b.id);
                rows.push([
                    b.id,
                    `${b.first_name} ${b.last_name}`,
                    bd.contract_value_with_charges.toString(),
                    bd.total_paid.toString(),
                    bd.remaining_balance.toString()
                ]);
            }
        }
        else if (type === 'aged-debt') {
            title = 'Aged Debt Analysis';
            headers = ['Buyer ID', 'Name', 'Stand', 'Current', '30 Days', '60 Days', '90+ Days', 'Total Arrears'];
            const buyers = await db_1.prisma.buyers.findMany({
                where: { stand: { project_id: projectId } },
                include: { stand: true }
            });
            for (const b of buyers) {
                const bal = await schedule_services_1.ScheduleService.getBalance(b.id);
                const arrears = Number(bal.arrearsAmount);
                if (arrears > 0) {
                    const schedule = await schedule_services_1.ScheduleService.getSchedule(b.id);
                    const perPeriod = schedule && schedule.periods.length > 0 ? Number(schedule.periods[0].total_expected) : 0;
                    let c0 = '0', c30 = '0', c60 = '0', c90 = '0';
                    if (arrears <= perPeriod)
                        c30 = arrears.toFixed(2);
                    else if (arrears <= perPeriod * 2) {
                        c30 = perPeriod.toFixed(2);
                        c60 = (arrears - perPeriod).toFixed(2);
                    }
                    else {
                        c30 = perPeriod.toFixed(2);
                        c60 = perPeriod.toFixed(2);
                        c90 = (arrears - perPeriod * 2).toFixed(2);
                    }
                    rows.push([
                        b.id, `${b.first_name} ${b.last_name}`, b.stand.stand_number,
                        c0, c30, c60, c90, arrears.toFixed(2)
                    ]);
                }
            }
        }
        else if (type === 'project-summary') {
            title = 'Project Performance Summary';
            headers = ['Financial Metric', 'Value'];
            const totalStands = await db_1.prisma.stands.count({ where: { project_id: projectId } });
            const soldStands = await db_1.prisma.stands.count({ where: { project_id: projectId, status: 'SOLD' } });
            const collectedAgg = await db_1.prisma.ledger_entries.aggregate({
                where: { buyer: { stand: { project_id: projectId } }, entry_type: 'PAYMENT', is_verified: true },
                _sum: { amount: true }
            });
            rows.push(['Total Portfolio Units', totalStands.toString()]);
            rows.push(['Portfolio Absorption (Sold)', soldStands.toString()]);
            rows.push(['Total Cash Inflow', collectedAgg._sum.amount?.toString() || '0.00']);
        }
        else if (type === 'stand-registry') {
            title = 'Stand Allocation Registry';
            headers = ['Stand #', 'Size (m²)', 'Price p/m²', 'Asset Value', 'Current Status'];
            const stands = await db_1.prisma.stands.findMany({
                where: { project_id: projectId },
                orderBy: { stand_number: 'asc' }
            });
            for (const s of stands) {
                const assetValue = Number(s.size_sqm) * Number(s.price_per_sqm);
                rows.push([s.stand_number, s.size_sqm.toString(), s.price_per_sqm.toString(), assetValue.toFixed(2), s.status]);
            }
        }
        else if (type === 'cashflow') {
            title = '12-Month Cashflow Projection';
            headers = ['Month', 'Expected Collections', 'Cumulative Total'];
            let cumulative = 0;
            for (let i = 0; i < 12; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() + i);
                const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                const mAgg = await db_1.prisma.instalment_periods.aggregate({
                    where: {
                        schedule: { stand: { project_id: projectId }, status: 'ACTIVE' },
                        due_date: { gte: mStart, lte: mEnd }
                    },
                    _sum: { total_expected: true }
                });
                const amount = Number(mAgg._sum.total_expected || 0);
                cumulative += amount;
                rows.push([
                    mStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
                    amount.toFixed(2),
                    cumulative.toFixed(2)
                ]);
            }
        }
        else if (type === 'audit-log') {
            title = 'System Administrative Audit Trail';
            headers = ['Timestamp', 'Admin User', 'Action', 'Entity', 'Details'];
            const logs = await db_1.prisma.audit_log.findMany({
                where: { created_at: { gte: startDate, lte: endDate } },
                include: { user: true },
                orderBy: { created_at: 'desc' },
                take: 500
            });
            for (const l of logs) {
                rows.push([
                    l.created_at.toISOString().split('T')[0],
                    l.user?.email || 'SYSTEM',
                    l.action,
                    `${l.entity_type} [${l.entity_id.slice(0, 8)}]`,
                    JSON.stringify(l.details).slice(0, 50) + '...'
                ]);
            }
        }
        else if (type === 'verification-report') {
            title = 'Payment Verification Status Report';
            headers = ['Date', 'Purchaser', 'Amount', 'Type', 'Status', 'Ref'];
            const entries = await db_1.prisma.ledger_entries.findMany({
                where: {
                    buyer: { stand: { project_id: projectId } },
                    effective_date: { gte: startDate, lte: endDate }
                },
                include: { buyer: true },
                orderBy: { effective_date: 'desc' }
            });
            for (const e of entries) {
                rows.push([
                    e.effective_date.toISOString().split('T')[0],
                    `${e.buyer.first_name} ${e.buyer.last_name}`,
                    e.amount.toString(),
                    e.entry_type,
                    e.is_verified ? 'VERIFIED' : 'PENDING REVIEW',
                    e.id.slice(0, 8)
                ]);
            }
        }
        else if (type === 'month-end') {
            const d = new Date();
            title = `Month-End Reconciliation: ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
            headers = ['Category', 'Opening Balance', 'Period Activity', 'Closing Balance'];
            const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            // Simplistic reconciliation for now: Payments vs Charges in period
            const payments = await db_1.prisma.ledger_entries.aggregate({
                where: { buyer: { stand: { project_id: projectId } }, entry_type: 'PAYMENT', is_verified: true, effective_date: { gte: mStart, lte: mEnd } },
                _sum: { amount: true }
            });
            const charges = await db_1.prisma.ledger_entries.aggregate({
                where: { buyer: { stand: { project_id: projectId } }, entry_type: { in: ['FEE', 'PENALTY'] }, effective_date: { gte: mStart, lte: mEnd } },
                _sum: { amount: true }
            });
            rows.push(['Buyer Collections', '0.00', payments._sum.amount?.toString() || '0.00', payments._sum.amount?.toString() || '0.00']);
            rows.push(['New Charges', '0.00', charges._sum.amount?.toString() || '0.00', charges._sum.amount?.toString() || '0.00']);
        }
        else if (type === 'collections-breakdown') {
            title = 'Collections Allocation Breakdown';
            headers = ['Date', 'Purchaser', 'Amount', 'Allocated To', 'Target ID'];
            const entries = await db_1.prisma.ledger_entries.findMany({
                where: {
                    buyer: { stand: { project_id: projectId } },
                    entry_type: 'PAYMENT',
                    is_verified: true,
                    effective_date: { gte: startDate, lte: endDate }
                },
                include: { buyer: true },
                orderBy: { effective_date: 'desc' }
            });
            for (const e of entries) {
                rows.push([
                    e.effective_date.toISOString().split('T')[0],
                    `${e.buyer.first_name} ${e.buyer.last_name}`,
                    Number(e.amount).toString(),
                    e.allocation_type || 'STAND',
                    e.allocation_target_id || 'N/A'
                ]);
            }
        }
        else {
            title = `${type} Report`;
            headers = ['Details'];
            rows = [['Standard generation applied. See Custom Wizard for specific breakdowns.']];
        }
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
            const output = (0, sync_1.stringify)([[notice || ''], headers, ...rows]);
            res.send(output);
        }
        else if (format === 'xlsx') {
            const wb = xlsx.utils.book_new();
            const wsData = [[notice || ''], headers, ...rows];
            const ws = xlsx.utils.aoa_to_sheet(wsData);
            xlsx.utils.book_append_sheet(wb, ws, 'Report');
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
            res.send(buffer);
        }
        else if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
            const doc = new pdfkit_1.default();
            doc.pipe(res);
            doc.fontSize(20).text(title, { underline: true });
            if (notice) {
                doc.fontSize(12).fillColor('red').text(notice).fillColor('black');
            }
            doc.moveDown();
            // Simple table rendering
            const startY = doc.y;
            let currentY = startY;
            // Headers
            headers.forEach((h, i) => {
                doc.text(h, 50 + (i * 120), currentY);
            });
            currentY += 20;
            rows.forEach(r => {
                r.forEach((cell, i) => {
                    doc.text(String(cell), 50 + (i * 120), currentY);
                });
                currentY += 20;
            });
            doc.end();
        }
        else {
            // JSON default - Enhanced with meta for drill-downs
            res.json({
                title,
                notice,
                headers,
                rows: rows || [],
                rowMeta: (rows || []).map(r => {
                    const isEntityReport = ['aged-debt', 'defaulters'].includes(type);
                    return {
                        id: isEntityReport ? r[0] : null,
                        type: isEntityReport ? 'buyer' : 'summary'
                    };
                })
            });
        }
    }
    static async generateCustomReport(projectId, config, format, res) {
        const notice = await this.getNotice(projectId);
        const startDate = config.startDate ? new Date(config.startDate) : new Date(0);
        const endDate = config.endDate ? new Date(config.endDate) : new Date();
        // Determine entry types to include
        const types = [];
        if (config.includePayments === 'true' || config.includePayments === true)
            types.push('PAYMENT');
        if (config.includeCharges === 'true' || config.includeCharges === true) {
            types.push('FEE');
            types.push('PENALTY');
        }
        // 1. Fetch Ledger Entries
        const entries = await db_1.prisma.ledger_entries.findMany({
            where: {
                buyer: { stand: { project_id: projectId } },
                effective_date: { gte: startDate, lte: endDate },
                entry_type: { in: types }
            },
            include: {
                buyer: { include: { stand: true } }
            },
            orderBy: { effective_date: 'asc' }
        });
        const headers = ['Date', 'Buyer Name', 'Stand', 'Type', 'Description', 'Amount', 'Status'];
        const rows = entries.map(e => [
            e.effective_date.toISOString().split('T')[0],
            `${e.buyer.first_name} ${e.buyer.last_name}`,
            e.buyer.stand.stand_number,
            e.entry_type,
            e.description,
            e.amount.toString(),
            e.is_verified ? 'Verified' : 'Pending'
        ]);
        // 2. Data aggregation for Arrears if requested
        if (config.includeArrears === 'true' || config.includeArrears === true) {
            const buyers = await db_1.prisma.buyers.findMany({
                where: { stand: { project_id: projectId } },
                include: { stand: true }
            });
            rows.push(['---', '---', '---', '---', '---', '---', '---']);
            rows.push(['ARREARS SUMMARY (as of end date)', '', '', '', '', '', '']);
            for (const b of buyers) {
                const bd = await schedule_services_1.ScheduleService.getBalance(b.id);
                if (bd.arrearsAmount.greaterThan(0)) {
                    rows.push([
                        'Balance due',
                        `${b.first_name} ${b.last_name}`,
                        b.stand.stand_number,
                        'ARREARS',
                        'Outstanding balance',
                        bd.arrearsAmount.toString(),
                        'DUE'
                    ]);
                }
            }
        }
        const title = 'Custom Financial Report';
        // Reuse generation logic
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="custom-report.csv"`);
            const output = (0, sync_1.stringify)([[notice || ''], headers, ...rows]);
            res.send(output);
        }
        else if (format === 'xlsx') {
            const wb = xlsx.utils.book_new();
            const wsData = [[notice || ''], headers, ...rows];
            const ws = xlsx.utils.aoa_to_sheet(wsData);
            xlsx.utils.book_append_sheet(wb, ws, 'Report');
            const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="custom-report.xlsx"`);
            res.send(buffer);
        }
        else if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="custom-report.pdf"`);
            const doc = new pdfkit_1.default();
            doc.pipe(res);
            doc.fontSize(20).text(title, { underline: true });
            doc.fontSize(10).text(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
            if (notice) {
                doc.fontSize(12).fillColor('red').text(notice).fillColor('black');
            }
            doc.moveDown();
            // Simplified PDF rendering for brevity (real version would use a table helper)
            let currentY = doc.y;
            headers.forEach((h, i) => doc.text(h, 40 + (i * 80), currentY, { width: 75 }));
            currentY += 20;
            rows.forEach(r => {
                if (currentY > 700) {
                    doc.addPage();
                    currentY = 50;
                }
                r.forEach((cell, i) => doc.text(String(cell), 40 + (i * 80), currentY, { width: 75 }));
                currentY += 20;
            });
            doc.end();
        }
        else {
            res.json({ title, notice, headers, rows });
        }
    }
}
exports.ReportService = ReportService;
