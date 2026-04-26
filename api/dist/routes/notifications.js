"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const rbac_1 = require("../middlewares/rbac");
const notification_services_1 = require("../services/notification.services");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/mine', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        // Assuming buyer context uses buyer_id from profile
        const buyerId = req.user.buyerId;
        if (!buyerId)
            throw { status: 403, message: 'Not a buyer' };
        const notifications = await notification_services_1.NotificationService.getNotifications(buyerId);
        res.json(notifications);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id/read', rbac_1.requireBuyerIsolation, async (req, res, next) => {
    try {
        const buyerId = req.user.buyerId;
        if (!buyerId)
            throw { status: 403, message: 'Not a buyer' };
        const notif = await notification_services_1.NotificationService.markAsRead(req.params.id, buyerId);
        res.json(notif);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
