"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_services_1 = require("../services/project.services");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const client_1 = require("@prisma/client");
const buyer_services_1 = require("../services/buyer.services");
const pop_services_1 = require("../services/pop.services");
const audit_services_1 = require("../services/audit.services");
const ledger_services_1 = require("../services/ledger.services");
const reconciliation_services_1 = require("../services/reconciliation.services");
const notification_services_1 = require("../services/notification.services");
const report_services_1 = require("../services/report.services");
const router = (0, express_1.Router)();
// Protect all project routes
router.use(auth_1.authMiddleware);
router.get('/', async (req, res, next) => {
    try {
        const projects = await project_services_1.ProjectService.listProjects(req.user.userId, req.user.role);
        res.json(projects);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, rbac_1.requireRole)(['SYSTEM_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string(),
            config: zod_1.z.object({
                currency: zod_1.z.string(),
                deposit_pct: zod_1.z.number().min(0).max(100),
                instalments_max: zod_1.z.number().int().positive(),
                interest_rate: zod_1.z.number().min(0),
                penalty_rate: zod_1.z.number().min(0)
            })
        });
        const parsed = schema.parse(req.body);
        const project = await project_services_1.ProjectService.createProject(parsed);
        res.status(201).json(project);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const project = await project_services_1.ProjectService.getProject(req.params.id);
        if (!project)
            return next({ status: 404, message: 'Not found' });
        res.json(project);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id/config', (0, rbac_1.requireRole)(['SYSTEM_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            currency: zod_1.z.string().optional(),
            deposit_pct: zod_1.z.number().min(0).max(100).optional(),
            instalments_max: zod_1.z.number().int().positive().optional(),
            interest_rate: zod_1.z.number().min(0).optional(),
            penalty_rate: zod_1.z.number().min(0).optional()
        });
        const parsed = schema.parse(req.body);
        const newConfig = await project_services_1.ProjectService.updateProjectConfig(req.params.id, parsed);
        res.json(newConfig);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/admins', (0, rbac_1.requireRole)(['SYSTEM_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ user_id: zod_1.z.string() });
        const parsed = schema.parse(req.body);
        const assignment = await project_services_1.ProjectService.assignAdmin(req.params.id, parsed.user_id);
        res.status(201).json(assignment);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/stands', rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ status: zod_1.z.nativeEnum(client_1.StandStatus).optional() });
        const parsed = schema.parse(req.query);
        const stands = await project_services_1.ProjectService.getStands(req.params.id, parsed.status);
        res.json(stands);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/stands', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            stand_number: zod_1.z.string(),
            size_sqm: zod_1.z.number().positive(),
            price_per_sqm: zod_1.z.number().positive(),
            status: zod_1.z.nativeEnum(client_1.StandStatus).optional()
        });
        const parsed = schema.parse(req.body);
        const stand = await project_services_1.ProjectService.createStand(req.params.id, parsed);
        res.status(201).json(stand);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/stands/bulk', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.array(zod_1.z.object({
            stand_number: zod_1.z.string(),
            size_sqm: zod_1.z.number().positive(),
            price_per_sqm: zod_1.z.number().positive(),
            status: zod_1.z.nativeEnum(client_1.StandStatus).optional()
        }));
        const parsed = schema.parse(req.body);
        const result = await project_services_1.ProjectService.createStands(req.params.id, parsed);
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id/stands/:stand_id', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ status: zod_1.z.nativeEnum(client_1.StandStatus) });
        const parsed = schema.parse(req.body);
        const stand = await project_services_1.ProjectService.updateStand(req.params.id, req.params.stand_id, parsed.status);
        res.json(stand);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return next({ status: 400, message: 'Invalid stand status enum value' });
        next(err);
    }
});
router.post('/:id/buyers', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            stand_id: zod_1.z.string(),
            first_name: zod_1.z.string(),
            last_name: zod_1.z.string(),
            email: zod_1.z.string().email(),
            id_number: zod_1.z.string().optional(),
            phone_number: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const buyer = await buyer_services_1.BuyerService.createBuyer(req.params.id, parsed);
        res.status(201).json(buyer);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/buyers', rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().optional(),
            stand_number: zod_1.z.string().optional(),
            payment_status: zod_1.z.nativeEnum(client_1.PaymentStatus).optional(),
            arrears_status: zod_1.z.enum(['true', 'false']).optional()
        });
        const parsed = schema.parse(req.query);
        const buyers = await buyer_services_1.BuyerService.listProjectBuyers(req.params.id, parsed);
        res.json(buyers);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/buyer-accounts', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const accounts = await buyer_services_1.BuyerService.listBuyerAccounts(req.params.id);
        res.json(accounts);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/buyer-accounts/:buyer_id/send-access', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const result = await buyer_services_1.BuyerService.sendBuyerAccessEmail(req.params.buyer_id);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/payments', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().optional(),
            stand_number: zod_1.z.string().optional(),
            start_date: zod_1.z.string().optional(),
            end_date: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.query);
        const payments = await ledger_services_1.LedgerService.listProjectPayments(req.params.id, parsed);
        res.json(payments);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/fees', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            name: zod_1.z.string().optional(),
            stand_number: zod_1.z.string().optional(),
            start_date: zod_1.z.string().optional(),
            end_date: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.query);
        const charges = await ledger_services_1.LedgerService.listProjectCharges(req.params.id, parsed);
        res.json(charges);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/pop/queue', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const queue = await pop_services_1.PopService.listQueue(req.params.id);
        res.json(queue);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/audit-logs', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            action: zod_1.z.string().optional(),
            entity_type: zod_1.z.string().optional(),
            user_id: zod_1.z.string().optional()
        });
        const parsed = schema.parse(req.query);
        const logs = await audit_services_1.AuditService.getLogs(req.params.id, parsed);
        res.json(logs);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/bulk-fees', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            amount: zod_1.z.number().positive(),
            description: zod_1.z.string().min(1),
            effective_date: zod_1.z.string()
        });
        const parsed = schema.parse(req.body);
        const result = await ledger_services_1.LedgerService.addBulkCharge(req.params.id, parsed, req.user.userId);
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/reconciliation', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const periods = await reconciliation_services_1.ReconciliationService.listPeriods(req.params.id);
        res.json(periods);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/reconciliation', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            start_date: zod_1.z.string(),
            end_date: zod_1.z.string()
        });
        const parsed = schema.parse(req.body);
        const period = await reconciliation_services_1.ReconciliationService.openPeriod(req.params.id, new Date(parsed.start_date), new Date(parsed.end_date));
        res.status(201).json(period);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/reconciliation/:period_id/close', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const period = await reconciliation_services_1.ReconciliationService.closePeriod(req.params.period_id, req.user.userId);
        res.json(period);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/announcements', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const announcements = await notification_services_1.NotificationService.getProjectAnnouncements(req.params.id);
        res.json(announcements);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/announcements', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            title: zod_1.z.string().min(1),
            message: zod_1.z.string().min(1),
            buyerIds: zod_1.z.array(zod_1.z.string()).optional()
        });
        const parsed = schema.parse(req.body);
        const result = await notification_services_1.NotificationService.broadcastAnnouncement(req.params.id, parsed, req.user.userId);
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/reports/:type', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const format = req.query.format || 'json';
        await report_services_1.ReportService.generateReport(req.params.type, req.params.id, format, res, req.query);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/reports/custom', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const format = req.query.format || 'xlsx';
        await report_services_1.ReportService.generateCustomReport(req.params.id, req.query, format, res);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id/dashboard', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), rbac_1.requireProjectIsolation, async (req, res, next) => {
    try {
        const data = await project_services_1.ProjectService.getDashboardData(req.params.id);
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
