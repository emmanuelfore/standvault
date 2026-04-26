import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requireBuyerIsolation } from '../middlewares/rbac';
import { NotificationService } from '../services/notification.services';

const router = Router();

router.use(authMiddleware);

router.get('/mine', requireBuyerIsolation, async (req: any, res, next) => {
  try {
    // Assuming buyer context uses buyer_id from profile
    const buyerId = req.user.buyerId; 
    if (!buyerId) throw { status: 403, message: 'Not a buyer' };
    const notifications = await NotificationService.getNotifications(buyerId);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', requireBuyerIsolation, async (req: any, res, next) => {
  try {
    const buyerId = req.user.buyerId;
    if (!buyerId) throw { status: 403, message: 'Not a buyer' };
    const notif = await NotificationService.markAsRead(req.params.id, buyerId);
    res.json(notif);
  } catch (err) {
    next(err);
  }
});

export default router;
