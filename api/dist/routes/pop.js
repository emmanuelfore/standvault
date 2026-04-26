"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const pop_services_1 = require("../services/pop.services");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.post('/:submission_id/approve', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const updated = await pop_services_1.PopService.approvePop(req.params.submission_id, req.user.userId);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:submission_id/reject', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({ reason: zod_1.z.string().min(1) });
        const parsed = schema.parse(req.body);
        const updated = await pop_services_1.PopService.rejectPop(req.params.submission_id, parsed.reason);
        res.json(updated);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
