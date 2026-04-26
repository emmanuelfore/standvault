import { Router } from 'express';
import { ProjectService } from '../services/project.services';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireRole, requireProjectIsolation } from '../middlewares/rbac';
import { StandStatus, PaymentStatus } from '@prisma/client';
import { BuyerService } from '../services/buyer.services';
import { PopService } from '../services/pop.services';
import { AuditService } from '../services/audit.services';
import { LedgerService } from '../services/ledger.services';
import { ReconciliationService } from '../services/reconciliation.services';
import { NotificationService } from '../services/notification.services';
import { ReportService } from '../services/report.services';

const router = Router();

// Protect all project routes
router.use(authMiddleware);

router.get('/', async (req: any, res, next) => {
  try {
    const projects = await ProjectService.listProjects(req.user.userId, req.user.role);
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole(['SYSTEM_ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string(),
      config: z.object({
        currency: z.string(),
        deposit_pct: z.number().min(0).max(100),
        instalments_max: z.number().int().positive(),
        interest_rate: z.number().min(0),
        penalty_rate: z.number().min(0)
      })
    });
    const parsed = schema.parse(req.body);
    const project = await ProjectService.createProject(parsed);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireProjectIsolation, async (req, res, next) => {
  try {
    const project = await ProjectService.getProject(req.params.id);
    if (!project) return next({ status: 404, message: 'Not found' });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/config', requireRole(['SYSTEM_ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      currency: z.string().optional(),
      deposit_pct: z.number().min(0).max(100).optional(),
      instalments_max: z.number().int().positive().optional(),
      interest_rate: z.number().min(0).optional(),
      penalty_rate: z.number().min(0).optional()
    });
    const parsed = schema.parse(req.body);
    const newConfig = await ProjectService.updateProjectConfig(req.params.id, parsed);
    res.json(newConfig);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/admins', requireRole(['SYSTEM_ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({ user_id: z.string() });
    const parsed = schema.parse(req.body);
    const assignment = await ProjectService.assignAdmin(req.params.id, parsed.user_id);
    res.status(201).json(assignment);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stands', requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({ status: z.nativeEnum(StandStatus).optional() });
    const parsed = schema.parse(req.query);
    const stands = await ProjectService.getStands(req.params.id, parsed.status);
    res.json(stands);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stands', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      stand_number: z.string(),
      size_sqm: z.number().positive(),
      price_per_sqm: z.number().positive(),
      status: z.nativeEnum(StandStatus).optional()
    });
    const parsed = schema.parse(req.body);
    const stand = await ProjectService.createStand(req.params.id, parsed);
    res.status(201).json(stand);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stands/bulk', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.array(z.object({
      stand_number: z.string(),
      size_sqm: z.number().positive(),
      price_per_sqm: z.number().positive(),
      status: z.nativeEnum(StandStatus).optional()
    }));
    const parsed = schema.parse(req.body);
    const result = await ProjectService.createStands(req.params.id, parsed);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/stands/:stand_id', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({ status: z.nativeEnum(StandStatus) });
    const parsed = schema.parse(req.body);
    const stand = await ProjectService.updateStand(req.params.id, req.params.stand_id, parsed.status);
    res.json(stand);
  } catch (err) {
    if (err instanceof z.ZodError) return next({ status: 400, message: 'Invalid stand status enum value' });
    next(err);
  }
});

router.post('/:id/buyers', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      stand_id: z.string(),
      first_name: z.string(),
      last_name: z.string(),
      email: z.string().email(),
      id_number: z.string().optional(),
      phone_number: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const buyer = await BuyerService.createBuyer(req.params.id, parsed);
    res.status(201).json(buyer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/buyers', requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      stand_number: z.string().optional(),
      payment_status: z.nativeEnum(PaymentStatus).optional(),
      arrears_status: z.enum(['true', 'false']).optional()
    });
    const parsed = schema.parse(req.query);
    const buyers = await BuyerService.listProjectBuyers(req.params.id, parsed);
    res.json(buyers);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/buyer-accounts', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const accounts = await BuyerService.listBuyerAccounts(req.params.id);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/buyer-accounts/:buyer_id/send-access', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const result = await BuyerService.sendBuyerAccessEmail(req.params.buyer_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/payments', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      stand_number: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional()
    });
    const parsed = schema.parse(req.query);
    const payments = await LedgerService.listProjectPayments(req.params.id, parsed);
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/fees', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      stand_number: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional()
    });
    const parsed = schema.parse(req.query);
    const charges = await LedgerService.listProjectCharges(req.params.id, parsed);
    res.json(charges);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/pop/queue', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const queue = await PopService.listQueue(req.params.id);
    res.json(queue);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/audit-logs', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      action: z.string().optional(),
      entity_type: z.string().optional(),
      user_id: z.string().optional()
    });
    const parsed = schema.parse(req.query);
    const logs = await AuditService.getLogs(req.params.id, parsed);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/bulk-fees', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req: any, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      description: z.string().min(1),
      effective_date: z.string()
    });
    const parsed = schema.parse(req.body);
    const result = await LedgerService.addBulkCharge(req.params.id, parsed, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reconciliation', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const periods = await ReconciliationService.listPeriods(req.params.id);
    res.json(periods);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reconciliation', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      start_date: z.string(),
      end_date: z.string()
    });
    const parsed = schema.parse(req.body);
    const period = await ReconciliationService.openPeriod(req.params.id, new Date(parsed.start_date), new Date(parsed.end_date));
    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reconciliation/:period_id/close', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req: any, res, next) => {
  try {
    const period = await ReconciliationService.closePeriod(req.params.period_id, req.user.userId);
    res.json(period);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/announcements', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const announcements = await NotificationService.getProjectAnnouncements(req.params.id);
    res.json(announcements);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/announcements', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req: any, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      message: z.string().min(1),
      buyerIds: z.array(z.string()).optional()
    });
    const parsed = schema.parse(req.body);
    const result = await NotificationService.broadcastAnnouncement(req.params.id, parsed, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reports/:type', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const format = req.query.format as string || 'json';
    await ReportService.generateReport(req.params.type, req.params.id, format, res, req.query);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/reports/custom', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const format = req.query.format as string || 'xlsx';
    await ReportService.generateCustomReport(req.params.id, req.query, format, res);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/dashboard', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), requireProjectIsolation, async (req, res, next) => {
  try {
    const data = await ProjectService.getDashboardData(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
