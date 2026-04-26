"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const buyer_services_1 = require("../services/buyer.services");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const schedule_services_1 = require("../services/schedule.services");
const ledger_services_1 = require("../services/ledger.services");
const pop_services_1 = require("../services/pop.services");
const penalty_services_1 = require("../services/penalty.services");
const document_services_1 = require("../services/document.services");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/:buyer_id/dashboard', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const data = await buyer_services_1.BuyerService.getDashboardData(req.params.buyer_id);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const buyer = await buyer_services_1.BuyerService.getBuyer(req.params.buyer_id);
        if (!buyer)
            return next({ status: 404, message: 'Buyer not found' });
        res.json(buyer);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:buyer_id/details', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        // Only personal details allowed, no ledger mutation here
        const schema = zod_1.z.object({
            first_name: zod_1.z.string().optional(),
            last_name: zod_1.z.string().optional(),
            id_number: zod_1.z.string().optional(),
            phone_number: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const updated = await buyer_services_1.BuyerService.updateBuyerDetails(req.params.buyer_id, parsed);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:buyer_id/account', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            email: zod_1.z.string().email()
        });
        const parsed = schema.parse(req.body);
        const updated = await buyer_services_1.BuyerService.updateBuyerAccount(req.params.buyer_id, parsed);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/schedule', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const schedule = await schedule_services_1.ScheduleService.getSchedule(req.params.buyer_id);
        if (!schedule)
            return next({ status: 404, message: 'Schedule not found' });
        res.json(schedule);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/schedule', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            start_date: zod_1.z.string().optional(),
            customDeposit: zod_1.z.number().nonnegative().optional(),
            customInstalments: zod_1.z.number().int().positive().optional()
        });
        const { start_date, customDeposit, customInstalments } = schema.parse(req.body);
        const schedule = await schedule_services_1.ScheduleService.initializeSchedule(req.params.buyer_id, {
            startDate: start_date ? new Date(start_date) : undefined,
            customInstalments,
            customDepositAmount: customDeposit
        });
        res.status(201).json(schedule);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/balance', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const balance = await schedule_services_1.ScheduleService.getBalance(req.params.buyer_id);
        res.json(balance);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/balance/breakdown', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const breakdown = await schedule_services_1.ScheduleService.getBalanceBreakdown(req.params.buyer_id);
        res.json(breakdown);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/ledger', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const ledger = await ledger_services_1.LedgerService.getLedger(req.params.buyer_id);
        res.json(ledger);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/ledger/payments', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            amount: zod_1.z.number().positive(),
            description: zod_1.z.string().optional(),
            effective_date: zod_1.z.string(), // ISO desc
            file_url: zod_1.z.string().url().optional(),
            allocation_type: zod_1.z.enum(['STAND', 'FEE']).optional(),
            allocation_target_id: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const entry = await ledger_services_1.LedgerService.addPayment(req.params.buyer_id, parsed, req.user.userId);
        res.status(201).json(entry);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/ledger/reversals', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            amount: zod_1.z.number().positive(),
            description: zod_1.z.string().min(1),
            effective_date: zod_1.z.string(),
            reverses_id: zod_1.z.string()
        });
        const parsed = schema.parse(req.body);
        const entry = await ledger_services_1.LedgerService.addReversal(req.params.buyer_id, parsed, req.user.userId);
        res.status(201).json(entry);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:buyer_id/ledger/:entry_id', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        await ledger_services_1.LedgerService.deletePayment();
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/ledger/fees', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            amount: zod_1.z.number().positive(),
            description: zod_1.z.string().min(1),
            effective_date: zod_1.z.string()
        });
        const parsed = schema.parse(req.body);
        const entry = await ledger_services_1.LedgerService.addCharge(req.params.buyer_id, parsed, req.user.userId);
        res.status(201).json(entry);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/penalty/calculate', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const result = await penalty_services_1.PenaltyService.calculatePenalty(req.params.buyer_id);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/penalty/:calc_id/approve', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const entry = await penalty_services_1.PenaltyService.approvePenalty(req.params.calc_id, req.user.userId);
        res.json(entry);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/pop', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            amount: zod_1.z.number().positive(),
            payment_date: zod_1.z.string(),
            file_url: zod_1.z.string().url()
        });
        const parsed = schema.parse(req.body);
        const submission = await pop_services_1.PopService.submitPop(req.params.buyer_id, parsed);
        res.status(201).json(submission);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/documents', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const docs = await document_services_1.DocumentService.listDocuments(req.params.buyer_id);
        res.json(docs);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:buyer_id/documents/balance-confirmation', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const breakdown = await schedule_services_1.ScheduleService.getBalanceBreakdown(req.params.buyer_id);
        const letter = {
            title: 'Balance Confirmation Letter',
            issued_on: new Date().toISOString(),
            breakdown
        };
        res.json(letter);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/documents', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            title: zod_1.z.string().min(1),
            document_type: zod_1.z.string().min(1),
            file_url: zod_1.z.string().url()
        });
        const parsed = schema.parse(req.body);
        const doc = await document_services_1.DocumentService.uploadDocument(req.params.buyer_id, parsed, req.user.userId);
        res.status(201).json(doc);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:buyer_id/password', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            password: zod_1.z.string().min(6)
        });
        const { password } = schema.parse(req.body);
        const result = await buyer_services_1.BuyerService.updateBuyerPassword(req.params.buyer_id, password);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:buyer_id', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const result = await buyer_services_1.BuyerService.deletePurchaserAccount(req.params.buyer_id);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
