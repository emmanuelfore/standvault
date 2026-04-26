"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const db_1 = require("../db");
const supabase_1 = require("../lib/supabase");
const authMiddleware = (req, res, next) => {
    (async () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next({ status: 401, message: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const { data, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
            if (error || !data.user?.email) {
                return next({ status: 401, message: 'Unauthorized' });
            }
            const user = await db_1.prisma.users.findUnique({
                where: { email: data.user.email.toLowerCase() }
            });
            if (!user) {
                return next({ status: 401, message: 'Unauthorized' });
            }
            const buyerProfile = user.role === 'BUYER'
                ? await db_1.prisma.buyers.findFirst({ where: { user_id: user.id } })
                : null;
            req.user = {
                userId: user.id,
                email: user.email,
                role: user.role,
                buyerId: buyerProfile?.id || null,
                supabaseUserId: data.user.id
            };
            next();
        }
        catch (err) {
            next({ status: 401, message: 'Unauthorized' });
        }
    })();
};
exports.authMiddleware = authMiddleware;
