"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const document_services_1 = require("../services/document.services");
const rbac_1 = require("../middlewares/rbac");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/:doc_id/versions', (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const versions = await document_services_1.DocumentService.listVersions(req.params.doc_id);
        res.json(versions);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
