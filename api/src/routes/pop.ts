import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { PopService } from '../services/pop.services';

const router = Router();

router.use(authMiddleware);

router.post('/:submission_id/approve', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const updated = await PopService.approvePop(req.params.submission_id, req.user.userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:submission_id/reject', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({ reason: z.string().min(1) });
    const parsed = schema.parse(req.body);
    const updated = await PopService.rejectPop(req.params.submission_id, parsed.reason);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
