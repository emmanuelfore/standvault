import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { DocumentService } from '../services/document.services';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.use(authMiddleware);

router.get('/:doc_id/versions', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    const versions = await DocumentService.listVersions(req.params.doc_id);
    res.json(versions);
  } catch (err) {
    next(err);
  }
});

export default router;
