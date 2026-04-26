import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.services';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string()
    });
    const parsed = schema.parse(req.body);

    const result = await AuthService.login(parsed.email, parsed.password);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid input' });
    }
    next(error);
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  // Client-side logout handles token deletion, optional server-side blacklist
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      redirectTo: z.string().url().optional()
    });
    const parsed = schema.parse(req.body);

    await AuthService.forgotPassword(parsed.email, parsed.redirectTo);
    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(8)
    });
    const parsed = schema.parse(req.body);

    await AuthService.resetPassword(parsed.token, parsed.newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid input' });
    }
    next(error);
  }
});

router.post('/set-password', async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string(),
      newPassword: z.string().min(8)
    });
    const parsed = schema.parse(req.body);

    await AuthService.setPassword(parsed.token, parsed.newPassword);
    res.json({ message: 'Password set successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid input' });
    }
    next(error);
  }
});

router.post('/sync-supabase-users', authMiddleware, requireRole(['SYSTEM_ADMIN', 'PROJECT_ADMIN']), async (req, res, next) => {
  try {
    const schema = z.object({
      redirectTo: z.string().url().optional()
    });
    const parsed = schema.parse(req.body || {});
    const result = await AuthService.syncExistingUsersToSupabase(parsed.redirectTo || `${process.env.PORTAL_URL || 'http://localhost:5174'}/set-password`);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next({ status: 400, message: 'Invalid input' });
    }
    next(error);
  }
});

export default router;
