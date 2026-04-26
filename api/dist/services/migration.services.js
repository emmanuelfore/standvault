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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const db_1 = require("../db");
const xlsx = __importStar(require("xlsx"));
const sync_1 = require("csv-parse/sync");
const client_1 = require("@prisma/client");
const supabase_1 = require("../lib/supabase");
const schedule_services_1 = require("./schedule.services");
const derivePaymentStatus = (standAmount, charges, payments) => {
    const totalDue = standAmount + charges;
    const outstanding = Math.max(totalDue - payments, 0);
    return {
        outstanding,
        paymentStatus: outstanding <= 0 ? client_1.PaymentStatus.FULLY_PAID : client_1.PaymentStatus.CURRENT,
        arrearsStatus: outstanding > 0
    };
};
class MigrationService {
    static generateTemplate() {
        const wb = xlsx.utils.book_new();
        const standsSheet = xlsx.utils.aoa_to_sheet([
            ['project_name', 'stand_number', 'size_sqm', 'price_per_sqm', 'status'],
            ['Sunset Estate', 'A-101', 300, 45, 'AVAILABLE']
        ]);
        const purchasersSheet = xlsx.utils.aoa_to_sheet([
            ['project_name', 'stand_number', 'first_name', 'last_name', 'email', 'phone_number', 'id_number', 'allocation_date', 'legacy_customer_code', 'total_contract_price', 'payment_plan_months', 'monthly_instalment', 'deposit_amount'],
            ['Sunset Estate', 'A-101', 'John', 'Doe', 'john@example.com', '+263771234567', '12-345678-A-12', '2025-11-01', 'CUST-001', 13500, 12, 1000, 1500]
        ]);
        const ledgerSheet = xlsx.utils.book_new();
        const ledgerSheetData = [
            ['project_name', 'stand_number', 'purchaser_email', 'entry_type', 'amount', 'effective_date', 'description', 'is_verified', 'reference_number'],
            ['Sunset Estate', 'A-101', 'john@example.com', 'FEE', 12000, '2025-11-01', 'Opening contract balance', 'TRUE', 'OPEN-001'],
            ['Sunset Estate', 'A-101', 'john@example.com', 'PAYMENT', 500, '2025-12-05', 'Deposit paid', 'TRUE', 'RCPT-1001']
        ];
        const ledgerWs = xlsx.utils.aoa_to_sheet(ledgerSheetData);
        xlsx.utils.book_append_sheet(wb, standsSheet, 'stands');
        xlsx.utils.book_append_sheet(wb, purchasersSheet, 'purchasers');
        xlsx.utils.book_append_sheet(wb, ledgerSheet, 'ledger');
        return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    static parseCsv(text) {
        if (!text || !text.trim())
            return [];
        return (0, sync_1.parse)(text.replace(/^\uFEFF/, ''), {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
    }
    static asString(value) {
        return String(value ?? '').trim();
    }
    static asOptionalString(value) {
        const normalized = this.asString(value);
        return normalized || undefined;
    }
    static asNumber(value) {
        if (value === null || value === undefined || value === '')
            return NaN;
        return Number(value);
    }
    static asBoolean(value) {
        const normalized = this.asString(value).toLowerCase();
        return normalized === 'true' || normalized === 'yes' || normalized === '1';
    }
    static asDateString(value) {
        const normalized = this.asString(value);
        return normalized;
    }
    static buildPreview(rows) {
        return rows.slice(0, 5);
    }
    static normalizeIdentity(firstName, lastName, idNumber) {
        return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${(idNumber || '').trim().toLowerCase()}`;
    }
    static async validateStructuredImport(payload) {
        const issues = [];
        const normalized = {
            stands: [],
            purchasers: [],
            ledger: []
        };
        const project = await db_1.prisma.projects.findUnique({
            where: { id: payload.project_id },
            include: {
                configs: {
                    orderBy: { version: 'desc' },
                    take: 1
                }
            }
        });
        if (!project) {
            throw { status: 404, message: 'Project not found' };
        }
        const currentConfig = project.configs[0];
        if (!currentConfig) {
            issues.push({
                level: 'error',
                section: 'purchasers',
                row: 0,
                field: 'project_config',
                message: 'Project has no active configuration. Add a project configuration before importing purchasers.'
            });
        }
        const existingStands = await db_1.prisma.stands.findMany({
            where: { project_id: payload.project_id }
        });
        const existingBuyers = await db_1.prisma.buyers.findMany({
            where: { stand: { project_id: payload.project_id } },
            include: { stand: true, user: true }
        });
        const standRows = this.parseCsv(payload.stands_csv);
        const purchaserRows = this.parseCsv(payload.purchasers_csv);
        const ledgerRows = this.parseCsv(payload.ledger_csv);
        const standNumbers = new Set();
        standRows.forEach((row, index) => {
            const parsed = {
                row: index + 2,
                project_name: this.asString(row.project_name),
                stand_number: this.asString(row.stand_number),
                size_sqm: this.asNumber(row.size_sqm),
                price_per_sqm: this.asNumber(row.price_per_sqm),
                status: (this.asString(row.status) || client_1.StandStatus.AVAILABLE)
            };
            if (!parsed.project_name) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'project_name', message: 'Project name is required.' });
            }
            if (parsed.project_name && parsed.project_name !== project.name) {
                issues.push({ level: 'warning', section: 'stands', row: parsed.row, field: 'project_name', message: `Project name "${parsed.project_name}" does not match selected project "${project.name}". Selected project will be used.` });
            }
            if (!parsed.stand_number) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'stand_number', message: 'Stand number is required.' });
            }
            if (standNumbers.has(parsed.stand_number)) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'stand_number', message: 'Duplicate stand number in import file.' });
            }
            standNumbers.add(parsed.stand_number);
            if (!Object.values(client_1.StandStatus).includes(parsed.status)) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'status', message: 'Invalid stand status.' });
            }
            if (Number.isNaN(parsed.size_sqm) || parsed.size_sqm <= 0) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'size_sqm', message: 'Size must be a positive number.' });
            }
            if (Number.isNaN(parsed.price_per_sqm) || parsed.price_per_sqm < 0) {
                issues.push({ level: 'error', section: 'stands', row: parsed.row, field: 'price_per_sqm', message: 'Price per sqm must be zero or greater.' });
            }
            normalized.stands.push(parsed);
        });
        const knownStandNumbers = new Set([
            ...existingStands.map((stand) => stand.stand_number),
            ...normalized.stands.map((stand) => stand.stand_number)
        ]);
        const purchaserEmails = new Set();
        const purchaserStandNumbers = new Set();
        const purchaserIdentities = new Set();
        purchaserRows.forEach((row, index) => {
            const parsed = {
                row: index + 2,
                project_name: this.asString(row.project_name),
                stand_number: this.asString(row.stand_number),
                first_name: this.asString(row.first_name),
                last_name: this.asString(row.last_name),
                email: this.asString(row.email).toLowerCase(),
                phone_number: this.asOptionalString(row.phone_number),
                id_number: this.asOptionalString(row.id_number),
                allocation_date: this.asOptionalString(row.allocation_date),
                legacy_customer_code: this.asOptionalString(row.legacy_customer_code),
                total_contract_price: this.asNumber(row.total_contract_price),
                payment_plan_months: this.asNumber(row.payment_plan_months),
                monthly_instalment: this.asNumber(row.monthly_instalment),
                deposit_amount: this.asNumber(row.deposit_amount)
            };
            if (!parsed.project_name) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'project_name', message: 'Project name is required.' });
            }
            if (parsed.project_name && parsed.project_name !== project.name) {
                issues.push({ level: 'warning', section: 'purchasers', row: parsed.row, field: 'project_name', message: `Project name "${parsed.project_name}" does not match selected project "${project.name}". Selected project will be used.` });
            }
            if (!parsed.stand_number || !knownStandNumbers.has(parsed.stand_number)) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'stand_number', message: 'Referenced stand was not found in the selected project or import file.' });
            }
            if (!parsed.first_name) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'first_name', message: 'First name is required.' });
            }
            if (!parsed.last_name) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'last_name', message: 'Last name is required.' });
            }
            if (!parsed.email || !parsed.email.includes('@')) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'email', message: 'A valid email address is required.' });
            }
            if (purchaserEmails.has(parsed.email)) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'email', message: 'Duplicate purchaser email in import file.' });
            }
            purchaserEmails.add(parsed.email);
            const identityKey = this.normalizeIdentity(parsed.first_name, parsed.last_name, parsed.id_number);
            if (purchaserIdentities.has(identityKey)) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'identity', message: 'Duplicate purchaser record detected for the same person in the import file.' });
            }
            purchaserIdentities.add(identityKey);
            if (purchaserStandNumbers.has(parsed.stand_number)) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'stand_number', message: 'More than one purchaser is assigned to the same stand in the import file.' });
            }
            purchaserStandNumbers.add(parsed.stand_number);
            const existingBuyerWithEmail = existingBuyers.find((buyer) => buyer.user.email.toLowerCase() === parsed.email);
            if (existingBuyerWithEmail && existingBuyerWithEmail.stand.stand_number !== parsed.stand_number) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'email', message: `Purchaser email already belongs to stand ${existingBuyerWithEmail.stand.stand_number}.` });
            }
            const existingBuyerForStand = existingBuyers.find((buyer) => buyer.stand.stand_number === parsed.stand_number);
            if (existingBuyerForStand && existingBuyerForStand.user.email.toLowerCase() !== parsed.email) {
                issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'stand_number', message: `Stand ${parsed.stand_number} is already allocated to ${existingBuyerForStand.first_name} ${existingBuyerForStand.last_name}.` });
            }
            if (parsed.payment_plan_months || parsed.monthly_instalment || parsed.deposit_amount) {
                if (!parsed.payment_plan_months || Number.isNaN(parsed.payment_plan_months)) {
                    issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'payment_plan_months', message: 'Payment plan months must be a number if any plan data is provided.' });
                }
                if (!parsed.monthly_instalment || Number.isNaN(parsed.monthly_instalment)) {
                    issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'monthly_instalment', message: 'Monthly instalment must be a number.' });
                }
                if (!parsed.deposit_amount || Number.isNaN(parsed.deposit_amount)) {
                    issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'deposit_amount', message: 'Deposit amount must be a number.' });
                }
                if (!parsed.allocation_date) {
                    issues.push({ level: 'error', section: 'purchasers', row: parsed.row, field: 'allocation_date', message: 'Allocation date is required to generate a backdated schedule.' });
                }
            }
            normalized.purchasers.push(parsed);
        });
        const knownPurchaserEmails = new Set([
            ...existingBuyers.map((buyer) => buyer.user.email.toLowerCase()),
            ...normalized.purchasers.map((buyer) => buyer.email.toLowerCase())
        ]);
        const ledgerFingerprints = new Set();
        ledgerRows.forEach((row, index) => {
            const parsed = {
                row: index + 2,
                project_name: this.asString(row.project_name),
                stand_number: this.asString(row.stand_number),
                purchaser_email: this.asString(row.purchaser_email).toLowerCase(),
                entry_type: this.asString(row.entry_type),
                amount: this.asNumber(row.amount),
                effective_date: this.asDateString(row.effective_date),
                description: this.asString(row.description) || 'Migrated entry',
                is_verified: row.is_verified === undefined || row.is_verified === '' ? true : this.asBoolean(row.is_verified),
                reference_number: this.asOptionalString(row.reference_number)
            };
            if (!parsed.project_name) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'project_name', message: 'Project name is required.' });
            }
            if (parsed.project_name && parsed.project_name !== project.name) {
                issues.push({ level: 'warning', section: 'ledger', row: parsed.row, field: 'project_name', message: `Project name "${parsed.project_name}" does not match selected project "${project.name}". Selected project will be used.` });
            }
            if (!knownStandNumbers.has(parsed.stand_number)) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'stand_number', message: 'Referenced stand was not found in the selected project or import file.' });
            }
            if (!knownPurchaserEmails.has(parsed.purchaser_email)) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'purchaser_email', message: 'Referenced purchaser email was not found in the selected project or import file.' });
            }
            if (!['PAYMENT', 'FEE', 'REVERSAL', 'PENALTY'].includes(parsed.entry_type)) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'entry_type', message: 'Entry type must be PAYMENT, FEE, REVERSAL, or PENALTY.' });
            }
            if (Number.isNaN(parsed.amount) || parsed.amount <= 0) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'amount', message: 'Amount must be a positive number.' });
            }
            if (Number.isNaN(new Date(parsed.effective_date).getTime())) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'effective_date', message: 'Effective date is invalid.' });
            }
            const ledgerFingerprint = `${parsed.purchaser_email}|${parsed.stand_number}|${parsed.entry_type}|${parsed.amount}|${parsed.effective_date}|${parsed.description}`;
            if (ledgerFingerprints.has(ledgerFingerprint)) {
                issues.push({ level: 'error', section: 'ledger', row: parsed.row, field: 'duplicate', message: 'Duplicate ledger row detected in the import file.' });
            }
            ledgerFingerprints.add(ledgerFingerprint);
            normalized.ledger.push(parsed);
        });
        const paymentsTotal = normalized.ledger
            .filter((entry) => entry.entry_type === 'PAYMENT')
            .reduce((sum, entry) => sum + entry.amount, 0);
        const chargesTotal = normalized.ledger
            .filter((entry) => entry.entry_type !== 'PAYMENT')
            .reduce((sum, entry) => sum + entry.amount, 0);
        return {
            project: { id: project.id, name: project.name },
            hasActiveConfig: Boolean(currentConfig),
            summary: {
                stands: normalized.stands.length,
                purchasers: normalized.purchasers.length,
                ledgerEntries: normalized.ledger.length,
                errors: issues.filter((issue) => issue.level === 'error').length,
                warnings: issues.filter((issue) => issue.level === 'warning').length,
                paymentsTotal,
                chargesTotal
            },
            preview: {
                stands: this.buildPreview(normalized.stands),
                purchasers: this.buildPreview(normalized.purchasers),
                ledger: this.buildPreview(normalized.ledger)
            },
            issues,
            normalized
        };
    }
    static async ensureSupabaseUser(email, redirectTo) {
        const { data: existingUsers, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });
        if (listError) {
            throw { status: 500, message: `Unable to query Supabase Auth users: ${listError.message}` };
        }
        const existingUser = existingUsers.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return { supabase_user_id: existingUser.id, invite_sent: false };
        }
        const { data, error } = await supabase_1.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo
        });
        if (error) {
            throw { status: 500, message: `Unable to invite ${email}: ${error.message}` };
        }
        return {
            supabase_user_id: data.user?.id || null,
            invite_sent: true
        };
    }
    static async createInvitationForUser(buyerId, email, baseUrl) {
        const { supabase_user_id, invite_sent } = await this.ensureSupabaseUser(email, baseUrl);
        return {
            buyer_id: buyerId,
            email,
            supabase_user_id,
            invite_sent: invite_sent
        };
    }
    static async commitStructuredImport(payload, userId, options) {
        const validation = await this.validateStructuredImport(payload);
        const errors = validation.issues.filter((issue) => issue.level === 'error');
        if (errors.length > 0) {
            throw {
                status: 400,
                message: 'Migration validation failed. Resolve the errors and try again.',
                report: validation
            };
        }
        const importLog = await db_1.prisma.migration_imports.create({
            data: {
                file_name: `structured-import-${validation.project.name}`,
                status: 'PROCESSING',
                total_rows: validation.summary.stands +
                    validation.summary.purchasers +
                    validation.summary.ledgerEntries,
                successful_rows: 0,
                committed_by: userId
            }
        });
        try {
            const currentConfig = await db_1.prisma.project_configs.findFirst({
                where: { project_id: payload.project_id },
                orderBy: { version: 'desc' }
            });
            if (!currentConfig) {
                throw { status: 400, message: 'Project has no active configuration.' };
            }
            let standsCreated = 0;
            let standsUpdated = 0;
            let purchasersCreated = 0;
            let purchasersUpdated = 0;
            let ledgerImported = 0;
            const standMap = new Map();
            const existingStands = await db_1.prisma.stands.findMany({
                where: { project_id: payload.project_id }
            });
            existingStands.forEach((stand) => {
                standMap.set(stand.stand_number, stand);
            });
            for (const standRow of validation.normalized.stands) {
                const existing = standMap.get(standRow.stand_number);
                if (existing) {
                    const updated = await db_1.prisma.stands.update({
                        where: { id: existing.id },
                        data: {
                            size_sqm: standRow.size_sqm,
                            price_per_sqm: standRow.price_per_sqm,
                            status: standRow.status
                        }
                    });
                    standMap.set(updated.stand_number, updated);
                    standsUpdated += 1;
                }
                else {
                    const created = await db_1.prisma.stands.create({
                        data: {
                            project_id: payload.project_id,
                            stand_number: standRow.stand_number,
                            size_sqm: standRow.size_sqm,
                            price_per_sqm: standRow.price_per_sqm,
                            status: standRow.status
                        }
                    });
                    standMap.set(created.stand_number, created);
                    standsCreated += 1;
                }
            }
            const projectBuyers = await db_1.prisma.buyers.findMany({
                where: { stand: { project_id: payload.project_id } },
                include: { user: true, stand: true }
            });
            const buyerByEmail = new Map();
            const buyerByStandId = new Map();
            projectBuyers.forEach((buyer) => {
                buyerByEmail.set(buyer.user.email.toLowerCase(), buyer);
                buyerByStandId.set(buyer.stand_id, buyer);
            });
            for (const purchaserRow of validation.normalized.purchasers) {
                const stand = standMap.get(purchaserRow.stand_number);
                if (!stand)
                    continue;
                const existingUser = await db_1.prisma.users.findUnique({
                    where: { email: purchaserRow.email }
                });
                if (existingUser && existingUser.role !== client_1.UserRole.BUYER) {
                    throw { status: 400, message: `User ${purchaserRow.email} already exists with a non-purchaser role.` };
                }
                const standBuyer = buyerByStandId.get(stand.id);
                const emailBuyer = buyerByEmail.get(purchaserRow.email);
                if (standBuyer && standBuyer.user.email.toLowerCase() !== purchaserRow.email) {
                    throw { status: 400, message: `Stand ${purchaserRow.stand_number} is already allocated to another purchaser.` };
                }
                if (emailBuyer) {
                    const updated = await db_1.prisma.buyers.update({
                        where: { id: emailBuyer.id },
                        data: {
                            first_name: purchaserRow.first_name,
                            last_name: purchaserRow.last_name,
                            id_number: purchaserRow.id_number,
                            phone_number: purchaserRow.phone_number,
                            allocation_date: purchaserRow.allocation_date ? new Date(purchaserRow.allocation_date) : new Date(),
                            total_contract_price: purchaserRow.total_contract_price || null,
                            payment_plan_months: purchaserRow.payment_plan_months || null,
                            monthly_instalment: purchaserRow.monthly_instalment || null,
                            deposit_amount: purchaserRow.deposit_amount || null,
                            legacy_customer_code: purchaserRow.legacy_customer_code || null,
                            stand_id: stand.id,
                            payment_status: client_1.PaymentStatus.CURRENT,
                            arrears_status: false
                        },
                        include: { user: true, stand: true }
                    });
                    buyerByEmail.set(updated.user.email.toLowerCase(), updated);
                    buyerByStandId.set(updated.stand_id, updated);
                    purchasersUpdated += 1;
                }
                else {
                    if (standBuyer) {
                        throw { status: 400, message: `Stand ${purchaserRow.stand_number} already has a purchaser and cannot be imported twice.` };
                    }
                    const user = existingUser || await db_1.prisma.users.create({
                        data: {
                            email: purchaserRow.email,
                            role: client_1.UserRole.BUYER,
                            password_hash: null
                        }
                    });
                    const created = await db_1.prisma.buyers.create({
                        data: {
                            user_id: user.id,
                            stand_id: stand.id,
                            project_config_id: currentConfig.id,
                            first_name: purchaserRow.first_name,
                            last_name: purchaserRow.last_name,
                            id_number: purchaserRow.id_number,
                            phone_number: purchaserRow.phone_number,
                            allocation_date: purchaserRow.allocation_date ? new Date(purchaserRow.allocation_date) : new Date(),
                            total_contract_price: purchaserRow.total_contract_price || null,
                            payment_plan_months: purchaserRow.payment_plan_months || null,
                            monthly_instalment: purchaserRow.monthly_instalment || null,
                            deposit_amount: purchaserRow.deposit_amount || null,
                            legacy_customer_code: purchaserRow.legacy_customer_code || null,
                            payment_status: client_1.PaymentStatus.CURRENT,
                            arrears_status: false
                        },
                        include: { user: true, stand: true }
                    });
                    buyerByEmail.set(created.user.email.toLowerCase(), created);
                    buyerByStandId.set(created.stand_id, created);
                    purchasersCreated += 1;
                }
                // Auto-generate schedule if plan data exists
                if (purchaserRow.payment_plan_months && purchaserRow.monthly_instalment) {
                    const buyer = buyerByEmail.get(purchaserRow.email);
                    // Check if schedule already exists
                    const existingSchedule = await db_1.prisma.instalment_schedules.findFirst({
                        where: { buyer_id: buyer.id }
                    });
                    if (!existingSchedule) {
                        // Check if ledger already has a deposit to avoid double-entry
                        const existingDeposit = validation.normalized.ledger.find(l => l.purchaser_email === purchaserRow.email &&
                            l.description.toLowerCase().includes('deposit'));
                        await schedule_services_1.ScheduleService.generateSchedule(buyer.id, currentConfig.id, stand.id, {
                            startDate: buyer.allocation_date,
                            depositDate: buyer.allocation_date,
                            customInstalments: purchaserRow.payment_plan_months,
                            customDepositAmount: purchaserRow.deposit_amount ? new client_1.Prisma.Decimal(purchaserRow.deposit_amount) : undefined
                        });
                    }
                }
                if (stand.status !== client_1.StandStatus.ALLOCATED) {
                    const updatedStand = await db_1.prisma.stands.update({
                        where: { id: stand.id },
                        data: { status: client_1.StandStatus.ALLOCATED }
                    });
                    standMap.set(updatedStand.stand_number, updatedStand);
                }
            }
            const importedBuyerIds = Array.from(buyerByEmail.values()).map((buyer) => buyer.id);
            const existingLedger = importedBuyerIds.length
                ? await db_1.prisma.ledger_entries.findMany({
                    where: { buyer_id: { in: importedBuyerIds } }
                })
                : [];
            const ledgerFingerprint = new Set(existingLedger.map((entry) => `${entry.buyer_id}|${entry.entry_type}|${Number(entry.amount).toFixed(2)}|${new Date(entry.effective_date).toISOString().slice(0, 10)}|${entry.description}`));
            for (const ledgerRow of validation.normalized.ledger) {
                const buyer = buyerByEmail.get(ledgerRow.purchaser_email);
                if (!buyer)
                    continue;
                const fingerprint = `${buyer.id}|${ledgerRow.entry_type}|${ledgerRow.amount.toFixed(2)}|${new Date(ledgerRow.effective_date).toISOString().slice(0, 10)}|${ledgerRow.description}`;
                if (ledgerFingerprint.has(fingerprint)) {
                    continue;
                }
                await db_1.prisma.ledger_entries.create({
                    data: {
                        buyer_id: buyer.id,
                        amount: ledgerRow.amount,
                        entry_type: ledgerRow.entry_type,
                        description: ledgerRow.description,
                        effective_date: new Date(ledgerRow.effective_date),
                        is_verified: ledgerRow.is_verified,
                        is_migrated: true,
                        created_by: userId
                    }
                });
                ledgerFingerprint.add(fingerprint);
                ledgerImported += 1;
            }
            for (const buyer of buyerByEmail.values()) {
                const chargesAgg = await db_1.prisma.ledger_entries.aggregate({
                    where: {
                        buyer_id: buyer.id,
                        entry_type: { in: ['FEE', 'PENALTY'] },
                        is_verified: true
                    },
                    _sum: { amount: true }
                });
                const paymentsAgg = await db_1.prisma.ledger_entries.aggregate({
                    where: {
                        buyer_id: buyer.id,
                        entry_type: 'PAYMENT',
                        is_verified: true
                    },
                    _sum: { amount: true }
                });
                const charges = Number(chargesAgg._sum.amount || 0);
                const payments = Number(paymentsAgg._sum.amount || 0);
                const standAmount = Number(buyer.stand?.size_sqm || 0) * Number(buyer.stand?.price_per_sqm || 0);
                const { paymentStatus, arrearsStatus } = derivePaymentStatus(standAmount, charges, payments);
                await db_1.prisma.buyers.update({
                    where: { id: buyer.id },
                    data: {
                        payment_status: paymentStatus,
                        arrears_status: arrearsStatus
                    }
                });
            }
            const invitationLinks = [];
            const baseUrl = options?.inviteBaseUrl || 'http://localhost:5174/set-password';
            const inviteEmails = validation.normalized.purchasers.map((row) => row.email);
            const uniqueInviteEmails = Array.from(new Set(inviteEmails));
            for (const email of uniqueInviteEmails) {
                const buyer = buyerByEmail.get(email);
                if (!buyer)
                    continue;
                const link = await this.createInvitationForUser(buyer.id, email, baseUrl);
                invitationLinks.push(link);
            }
            await db_1.prisma.migration_imports.update({
                where: { id: importLog.id },
                data: {
                    status: 'SUCCESS',
                    successful_rows: standsCreated + standsUpdated + purchasersCreated + purchasersUpdated + ledgerImported
                }
            });
            return {
                import_id: importLog.id,
                summary: validation.summary,
                results: {
                    standsCreated,
                    standsUpdated,
                    purchasersCreated,
                    purchasersUpdated,
                    ledgerImported
                },
                invitation_links: invitationLinks,
                issues: validation.issues
            };
        }
        catch (error) {
            await db_1.prisma.migration_imports.update({
                where: { id: importLog.id },
                data: {
                    status: 'FAILED',
                    successful_rows: 0
                }
            });
            throw error;
        }
    }
    static async createInvitationLinks(projectId, emails, baseUrl) {
        const buyers = await db_1.prisma.buyers.findMany({
            where: {
                stand: { project_id: projectId },
                user: { email: { in: emails.map((email) => email.toLowerCase()) } }
            },
            include: { user: true }
        });
        const buyerMap = new Map(buyers.map((buyer) => [buyer.user.email.toLowerCase(), buyer]));
        const missingEmails = emails.filter((email) => !buyerMap.has(email.toLowerCase()));
        const invitation_links = [];
        for (const email of emails) {
            const buyer = buyerMap.get(email.toLowerCase());
            if (!buyer)
                continue;
            const link = await this.createInvitationForUser(buyer.id, email.toLowerCase(), baseUrl);
            invitation_links.push(link);
        }
        return {
            invitation_links,
            missing_emails: missingEmails
        };
    }
}
exports.MigrationService = MigrationService;
