"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const db_1 = require("../db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const supabase_1 = require("../lib/supabase");
class AuthService {
    static async bootstrapLegacyUserToSupabase(email, password) {
        const { data: existingUsers, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });
        if (listError) {
            throw { status: 500, message: `Unable to query Supabase Auth users: ${listError.message}` };
        }
        const existingUser = existingUsers.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return;
        }
        const { error: createError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (createError) {
            throw { status: 500, message: `Unable to create Supabase Auth user: ${createError.message}` };
        }
    }
    static async login(email, password) {
        const normalizedEmail = email.toLowerCase();
        const user = await db_1.prisma.users.findUnique({ where: { email: normalizedEmail } });
        if (!user) {
            throw { status: 401, message: 'Invalid email or password' };
        }
        let signInResponse = await supabase_1.supabasePublic.auth.signInWithPassword({
            email: normalizedEmail,
            password
        });
        if (signInResponse.error || !signInResponse.data.session) {
            if (!user.password_hash) {
                throw { status: 401, message: 'Invalid email or password' };
            }
            const isLegacyPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
            if (!isLegacyPasswordValid) {
                throw { status: 401, message: 'Invalid email or password' };
            }
            await this.bootstrapLegacyUserToSupabase(normalizedEmail, password);
            signInResponse = await supabase_1.supabasePublic.auth.signInWithPassword({
                email: normalizedEmail,
                password
            });
            if (signInResponse.error || !signInResponse.data.session) {
                throw { status: 401, message: 'Invalid email or password' };
            }
        }
        let buyerId = null;
        if (user.role === 'BUYER') {
            const buyer = await db_1.prisma.buyers.findFirst({ where: { user_id: user.id } });
            buyerId = buyer?.id || null;
        }
        return {
            token: signInResponse.data.session.access_token,
            refreshToken: signInResponse.data.session.refresh_token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                buyerId
            }
        };
    }
    static async forgotPassword(email, redirectTo) {
        const normalizedEmail = email.toLowerCase();
        const user = await db_1.prisma.users.findUnique({ where: { email: normalizedEmail } });
        if (!user)
            return; // Silent return for security
        const { data: existingUsers, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });
        if (listError) {
            throw { status: 500, message: `Unable to query Supabase Auth users: ${listError.message}` };
        }
        const existingUser = existingUsers.users.find((authUser) => authUser.email?.toLowerCase() === normalizedEmail);
        if (!existingUser) {
            const temporaryPassword = `${crypto_1.default.randomUUID()}!Aa1`;
            const { error: createError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
                email: normalizedEmail,
                password: temporaryPassword,
                email_confirm: true
            });
            if (createError) {
                throw { status: 500, message: `Unable to provision Supabase Auth user: ${createError.message}` };
            }
        }
        const { error: resetError } = await supabase_1.supabasePublic.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: redirectTo || `${process.env.PORTAL_URL || 'http://localhost:5174'}/reset-password`
        });
        if (resetError) {
            throw { status: 500, message: `Unable to send reset link: ${resetError.message}` };
        }
    }
    static async syncExistingUsersToSupabase(redirectTo) {
        const localUsers = await db_1.prisma.users.findMany({
            orderBy: { created_at: 'asc' }
        });
        const { data: existingUsers, error } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
        });
        if (error) {
            throw { status: 500, message: `Unable to list Supabase users: ${error.message}` };
        }
        const existingEmails = new Set(existingUsers.users.map((user) => user.email?.toLowerCase()).filter(Boolean));
        const results = [];
        for (const localUser of localUsers) {
            const email = localUser.email.toLowerCase();
            if (existingEmails.has(email)) {
                results.push({ email, status: 'already_exists' });
                continue;
            }
            const { data, error: inviteError } = await supabase_1.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                redirectTo
            });
            if (inviteError) {
                results.push({ email, status: 'failed', error: inviteError.message });
                continue;
            }
            results.push({
                email,
                status: 'invited',
                supabase_user_id: data.user?.id || null
            });
        }
        return {
            total: localUsers.length,
            invited: results.filter((result) => result.status === 'invited').length,
            already_exists: results.filter((result) => result.status === 'already_exists').length,
            failed: results.filter((result) => result.status === 'failed').length,
            results
        };
    }
    static async resetPassword(token, newPassword) {
        // Find the token not used and not expired
        const allTokens = await db_1.prisma.tokens.findMany({
            where: {
                type: 'PASSWORD_RESET',
                used_at: null,
                expires_at: { gt: new Date() }
            }
        });
        let validTokenRecord = null;
        for (const record of allTokens) {
            if (await bcryptjs_1.default.compare(token, record.token_hash)) {
                validTokenRecord = record;
                break;
            }
        }
        if (!validTokenRecord) {
            throw { status: 400, message: 'Invalid or expired token' };
        }
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.prisma.$transaction([
            db_1.prisma.users.update({
                where: { id: validTokenRecord.user_id },
                data: { password_hash: newPasswordHash, updated_at: new Date() }
            }),
            db_1.prisma.tokens.update({
                where: { id: validTokenRecord.id },
                data: { used_at: new Date() }
            })
        ]);
    }
    static async setPassword(token, newPassword) {
        // Similar to resetPassword but for INVITATION tokens
        const allTokens = await db_1.prisma.tokens.findMany({
            where: {
                type: 'INVITATION',
                used_at: null,
                expires_at: { gt: new Date() }
            }
        });
        let validTokenRecord = null;
        for (const record of allTokens) {
            if (await bcryptjs_1.default.compare(token, record.token_hash)) {
                validTokenRecord = record;
                break;
            }
        }
        if (!validTokenRecord) {
            throw { status: 400, message: 'Invalid or expired invitation token' };
        }
        const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
        await db_1.prisma.$transaction([
            db_1.prisma.users.update({
                where: { id: validTokenRecord.user_id },
                data: { password_hash: newPasswordHash, updated_at: new Date() }
            }),
            db_1.prisma.tokens.update({
                where: { id: validTokenRecord.id },
                data: { used_at: new Date() }
            })
        ]);
    }
}
exports.AuthService = AuthService;
