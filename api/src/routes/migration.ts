import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';
import { MigrationService } from '../services/migration.services';
import { z } from 'zod';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']));

const importSchema = z.object({
  project_id: z.string(),
  stands_csv: z.string().optional(),
  purchasers_csv: z.string().optional(),
  ledger_csv: z.string().optional()
});

router.get('/template', (req, res) => {
  const buffer = MigrationService.generateTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="migration_template.xlsx"');
  res.send(buffer);
});

router.post('/validate', async (req, res, next) => {
  try {
    const parsed = importSchema.parse(req.body);
    const report = await MigrationService.validateStructuredImport(parsed);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post('/commit', async (req: any, res, next) => {
  try {
    const schema = importSchema.extend({
      invite_base_url: z.string().url().optional()
    });
    const parsed = schema.parse(req.body);
    const result = await MigrationService.commitStructuredImport(parsed, req.user.userId, {
      inviteBaseUrl: parsed.invite_base_url
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/invitations', async (req, res, next) => {
  try {
    const schema = z.object({
      project_id: z.string(),
      emails: z.array(z.string().email()).min(1),
      invite_base_url: z.string().url()
    });
    const parsed = schema.parse(req.body);
    const result = await MigrationService.createInvitationLinks(parsed.project_id, parsed.emails, parsed.invite_base_url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
