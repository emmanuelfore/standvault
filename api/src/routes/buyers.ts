import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { BuyerService } from '../services/buyer.services';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireBuyerIsolation, requireRole, preventBuyerFinancialMutation } from '../middlewares/rbac';
import { ScheduleService } from '../services/schedule.services';
import { LedgerService } from '../services/ledger.services';
import { PopService } from '../services/pop.services';
import { PenaltyService } from '../services/penalty.services';
import { DocumentService } from '../services/document.services';

const router = Router();

router.use(authMiddleware);

router.get('/:buyer_id/dashboard', requireBuyerIsolation, async (req, res, next) => {
  try {
    const data = await BuyerService.getDashboardData(req.params.buyer_id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id', requireBuyerIsolation, async (req, res, next) => {
  try {
    const buyer = await BuyerService.getBuyer(req.params.buyer_id);
    if (!buyer) return next({ status: 404, message: 'Buyer not found' });
    res.json(buyer);
  } catch (err) {
    next(err);
  }
});

router.patch('/:buyer_id/details', requireBuyerIsolation, async (req, res, next) => {
  try {
    // Only personal details allowed, no ledger mutation here
    const schema = z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      id_number: z.string().optional(),
      phone_number: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const updated = await BuyerService.updateBuyerDetails(req.params.buyer_id, parsed);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch('/:buyer_id/account', requireBuyerIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email()
    });
    const parsed = schema.parse(req.body);
    const updated = await BuyerService.updateBuyerAccount(req.params.buyer_id, parsed);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/schedule', requireBuyerIsolation, async (req, res, next) => {
  try {
    const schedule = await ScheduleService.getSchedule(req.params.buyer_id);
    if (!schedule) return next({ status: 404, message: 'Schedule not found' });
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/schedule', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({ 
      start_date: z.string().optional(),
      customDeposit: z.number().nonnegative().optional(),
      customInstalments: z.number().int().positive().optional()
    });
    const { start_date, customDeposit, customInstalments } = schema.parse(req.body);
    
    const schedule = await ScheduleService.initializeSchedule(req.params.buyer_id, {
       startDate: start_date ? new Date(start_date) : undefined,
       customInstalments,
       customDepositAmount: customDeposit
    });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/balance', requireBuyerIsolation, async (req, res, next) => {
  try {
    const balance = await ScheduleService.getBalance(req.params.buyer_id);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/balance/breakdown', requireBuyerIsolation, async (req, res, next) => {
  try {
    const breakdown = await ScheduleService.getBalanceBreakdown(req.params.buyer_id);
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/ledger', requireBuyerIsolation, async (req, res, next) => {
  try {
    const ledger = await LedgerService.getLedger(req.params.buyer_id);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/ledger/payments', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      description: z.string().optional(),
      effective_date: z.string(), // ISO desc
      file_url: z.string().url().optional(),
      allocation_type: z.enum(['STAND', 'FEE']).optional(),
      allocation_target_id: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const entry = await LedgerService.addPayment(req.params.buyer_id, parsed, req.user.userId);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/ledger/reversals', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      description: z.string().min(1),
      effective_date: z.string(),
      reverses_id: z.string()
    });
    const parsed = schema.parse(req.body);
    const entry = await LedgerService.addReversal(req.params.buyer_id, parsed, req.user.userId);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.delete('/:buyer_id/ledger/:entry_id', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    await LedgerService.deletePayment();
  } catch (err) {
    next(err);
  }
});


router.post('/:buyer_id/ledger/fees', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      description: z.string().min(1),
      effective_date: z.string()
    });
    const parsed = schema.parse(req.body);
    const entry = await LedgerService.addCharge(req.params.buyer_id, parsed, req.user.userId);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/penalty/calculate', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    const result = await PenaltyService.calculatePenalty(req.params.buyer_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/penalty/:calc_id/approve', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const entry = await PenaltyService.approvePenalty(req.params.calc_id, req.user.userId);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/pop', requireBuyerIsolation, async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      payment_date: z.string(),
      file_url: z.string().url()
    });
    const parsed = schema.parse(req.body);
    const submission = await PopService.submitPop(req.params.buyer_id, parsed);
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/documents', requireBuyerIsolation, async (req, res, next) => {
  try {
    const docs = await DocumentService.listDocuments(req.params.buyer_id);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.get('/:buyer_id/documents/balance-confirmation', requireBuyerIsolation, async (req, res, next) => {
  try {
    const breakdown = await ScheduleService.getBalanceBreakdown(req.params.buyer_id);
    const letter = {
       title: 'Balance Confirmation Letter',
       issued_on: new Date().toISOString(),
       breakdown
    };
    res.json(letter);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/documents', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      document_type: z.string().min(1),
      file_url: z.string().url()
    });
    const parsed = schema.parse(req.body);
    const doc = await DocumentService.uploadDocument(req.params.buyer_id, parsed, req.user.userId);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.post('/:buyer_id/password', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req: any, res, next) => {
  try {
    const schema = z.object({
      password: z.string().min(6)
    });
    const { password } = schema.parse(req.body);
    const result = await BuyerService.updateBuyerPassword(req.params.buyer_id, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:buyer_id', requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    const result = await BuyerService.deletePurchaserAccount(req.params.buyer_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
