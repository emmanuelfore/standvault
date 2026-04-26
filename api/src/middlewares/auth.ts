import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { supabaseAdmin } from '../lib/supabase';

export const authMiddleware = (req: any, res: Response, next: NextFunction) => {
  (async () => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next({ status: 401, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user?.email) {
      return next({ status: 401, message: 'Unauthorized' });
    }

    const user = await prisma.users.findUnique({
      where: { email: data.user.email.toLowerCase() }
    });

    if (!user) {
      return next({ status: 401, message: 'Unauthorized' });
    }

    const buyerProfile = user.role === 'BUYER'
      ? await prisma.buyers.findFirst({ where: { user_id: user.id } })
      : null;

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      buyerId: buyerProfile?.id || null,
      supabaseUserId: data.user.id
    };
    next();
  } catch (err) {
    next({ status: 401, message: 'Unauthorized' });
  }
  })();
};
