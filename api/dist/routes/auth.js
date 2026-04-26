"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_services_1 = require("../services/auth.services");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const router = (0, express_1.Router)();
router.post('/login', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string()
        });
        const parsed = schema.parse(req.body);
        const result = await auth_services_1.AuthService.login(parsed.email, parsed.password);
        res.json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return next({ status: 400, message: 'Invalid input' });
        }
        next(error);
    }
});
router.post('/logout', auth_1.authMiddleware, (req, res) => {
    // Client-side logout handles token deletion, optional server-side blacklist
    res.json({ message: 'Logged out successfully' });
});
router.get('/me', auth_1.authMiddleware, (req, res) => {
    res.json({ user: req.user });
});
router.post('/forgot-password', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            email: zod_1.z.string().email(),
            redirectTo: zod_1.z.string().url().optional()
        });
        const parsed = schema.parse(req.body);
        await auth_services_1.AuthService.forgotPassword(parsed.email, parsed.redirectTo);
        res.json({ message: 'If an account exists, a reset link has been sent.' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/reset-password', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            token: zod_1.z.string(),
            newPassword: zod_1.z.string().min(8)
        });
        const parsed = schema.parse(req.body);
        await auth_services_1.AuthService.resetPassword(parsed.token, parsed.newPassword);
        res.json({ message: 'Password reset successfully' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return next({ status: 400, message: 'Invalid input' });
        }
        next(error);
    }
});
router.post('/set-password', async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            token: zod_1.z.string(),
            newPassword: zod_1.z.string().min(8)
        });
        const parsed = schema.parse(req.body);
        await auth_services_1.AuthService.setPassword(parsed.token, parsed.newPassword);
        res.json({ message: 'Password set successfully' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return next({ status: 400, message: 'Invalid input' });
        }
        next(error);
    }
});
router.post('/sync-supabase-users', auth_1.authMiddleware, (0, rbac_1.requireRole)(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
    try {
        const schema = zod_1.z.object({
            redirectTo: zod_1.z.string().url().optional()
        });
        const parsed = schema.parse(req.body || {});
        const result = await auth_services_1.AuthService.syncExistingUsersToSupabase(parsed.redirectTo || `${process.env.PORTAL_URL || 'http://localhost:5174'}/set-password`);
        res.json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return next({ status: 400, message: 'Invalid input' });
        }
        next(error);
    }
});
exports.default = router;
