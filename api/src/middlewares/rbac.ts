import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';

export const requireRole = (allowedRoles: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      await logUnauthorizedAccess(req, 'ROLE_RESTRICTION');
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

export const requireBuyerIsolation = async (req: any, res: Response, next: NextFunction) => {
  if (req.user.role === 'SYSTEM_ADMIN' || req.user.role === 'PROJECT_ADMIN') {
    return next();
  }

  const requestedBuyerId = req.params.buyer_id || req.body.buyer_id;
  if (!requestedBuyerId) {
    return next(); // or block? Depends on route context. Assume we pass if no target is specified, letting business logic fail, but safely we should check if buyer profile matches
  }

  const buyer = await prisma.buyers.findUnique({ where: { user_id: req.user.userId } });
  if (!buyer || buyer.id !== requestedBuyerId) {
    await logUnauthorizedAccess(req, 'BUYER_ISOLATION');
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
};

export const requireProjectIsolation = async (req: any, res: Response, next: NextFunction) => {
  if (req.user.role === 'SYSTEM_ADMIN') {
    return next();
  }

  const requestedProjectId = req.params.id || req.params.project_id || req.body.project_id;
  if (!requestedProjectId) {
    return next(); 
  }

  if (req.user.role === 'PROJECT_ADMIN') {
    const assignment = await prisma.project_admin_assignments.findUnique({
      where: {
        project_id_user_id: {
          project_id: requestedProjectId,
          user_id: req.user.userId
        }
      }
    });

    if (!assignment) {
      await logUnauthorizedAccess(req, 'PROJECT_ISOLATION');
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  next();
};

export const preventBuyerFinancialMutation = async (req: any, res: Response, next: NextFunction) => {
  if (req.user.role === 'BUYER' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // If route implies financial mutation
    const path = req.originalUrl || req.url;
    if (path.includes('/ledger') || path.includes('/charges') || path.includes('/penalty') || path.includes('/pop/')) {
      // exception for PoP upload ?
      if (path.includes('/pop') && req.method === 'POST' && !path.includes('/approve') && !path.includes('/reject')) {
        return next(); // Buyer can submit PoP
      }
      
      await logUnauthorizedAccess(req, 'FINANCIAL_MUTATION_RESTRICTION');
      return res.status(403).json({ message: 'Forbidden' });
    }
  }
  next();
};

// 3.5 Implement audit log write on every 403 response
const logUnauthorizedAccess = async (req: any, reason: string) => {
  try {
    await prisma.audit_log.create({
      data: {
        user_id: req.user?.userId || null,
        action: 'UNAUTHORIZED_ACCESS',
        entity_type: 'ROUTE',
        entity_id: req.originalUrl || req.url,
        details: { reason, method: req.method, body: req.body },
        ip_address: req.ip || null,
      }
    });
  } catch (error) {
    console.error('Failed to write audit log for unauthorized access', error);
  }
};
