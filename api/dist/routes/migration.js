"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const migration_services_1 = require("../services/migration.services");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.use((0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']));
const importSchema = zod_1.z.object({
    project_id: zod_1.z.string(),
    stands_csv: zod_1.z.string().optional(),
    purchasers_csv: zod_1.z.string().optional(),
    ledger_csv: zod_1.z.string().optional()
});
router.get('/template', (req, res) => {
    const buffer = migration_services_1.MigrationService.generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="migration_template.xlsx"');
    res.send(buffer);
});
router.post('/validate', async (req, res, next) => {
    try {
        const parsed = importSchema.parse(req.body);
        const report = await migration_services_1.MigrationService.validateStructuredImport(parsed);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
router.post('/commit', async (req, res, next) => {
    try {
        const schema = importSchema.extend({
            invite_base_url: zod_1.z.string().url().optional()
        });
        const parsed = schema.parse(req.body);
        const result = await migration_services_1.MigrationService.commitStructuredImport(parsed, req.user.userId, {
            inviteBaseUrl: parsed.invite_base_url
        });
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/invitations', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            project_id: zod_1.z.string(),
            emails: zod_1.z.array(zod_1.z.string().email()).min(1),
            invite_base_url: zod_1.z.string().url()
        });
        const parsed = schema.parse(req.body);
        const result = await migration_services_1.MigrationService.createInvitationLinks(parsed.project_id, parsed.emails, parsed.invite_base_url);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
