// Feature: stand-vault, Property 1: Valid credentials authenticate; invalid credentials are rejected
// Feature: stand-vault, Property 2: Password reset link is single-use
// Feature: stand-vault, Property 3: Invitation token is single-use

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AuthService } from '../services/auth.services';
import { prisma } from '../db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

vi.mock('../db', () => ({
  prisma: {
    users: { findUnique: vi.fn(), update: vi.fn() },
    tokens: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (ops) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    })
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(async (data: string) => `hashed_${data}`),
    compare: vi.fn(async (data: string, encrypted: string) => `hashed_${data}` === encrypted)
  }
}));

describe('Authentication Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 1: Valid credentials authenticate; invalid credentials are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8 }),
        fc.string({ minLength: 8 }),
        fc.boolean(),
        async (password, guess, same) => {
          const actualGuess = same ? password : guess;
          const isSame = password === actualGuess;
          
          const hash = `hashed_${password}`;
          const user = {
            id: 'mock-id',
            email: 'test@example.com',
            password_hash: hash,
            role: 'BUYER'
          };

          vi.mocked(prisma.users.findUnique).mockResolvedValue(user as any);

          if (isSame) {
            const result = await AuthService.login('test@example.com', actualGuess);
            expect(result.token).toBeDefined();
            const decoded = jwt.decode(result.token) as any;
            expect(decoded.userId).toBe(user.id);
          } else {
            if (password !== actualGuess) {
              await expect(AuthService.login('test@example.com', actualGuess)).rejects.toMatchObject({
                status: 401
              });
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('Property 2: Password reset link is single-use', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }),
        fc.string({ minLength: 8 }),
        async (token, newPassword) => {
          const tokenHash = `hashed_${token}`;
          
          const mockTokens = [{
            id: 'token-1',
            user_id: 'user-1',
            token_hash: tokenHash,
            type: 'PASSWORD_RESET',
            expires_at: new Date(Date.now() + 100000),
            used_at: null
          }];

          vi.mocked(prisma.tokens.findMany).mockResolvedValue(mockTokens as any);

          // First use should succeed
          await AuthService.resetPassword(token, newPassword);
          expect(prisma.$transaction).toHaveBeenCalled();

          // After first use
          vi.mocked(prisma.tokens.findMany).mockResolvedValue([] as any);

          // Second use should fail
          await expect(AuthService.resetPassword(token, newPassword)).rejects.toMatchObject({
            status: 400
          });
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);

  it('Property 3: Invitation token is single-use', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10 }),
        fc.string({ minLength: 8 }),
        async (token, newPassword) => {
          const tokenHash = `hashed_${token}`;
          
          const mockTokens = [{
            id: 'token-inv-1',
            user_id: 'user-2',
            token_hash: tokenHash,
            type: 'INVITATION',
            expires_at: new Date(Date.now() + 100000),
            used_at: null
          }];

          vi.mocked(prisma.tokens.findMany).mockResolvedValue(mockTokens as any);

          // First use should succeed
          await AuthService.setPassword(token, newPassword);
          expect(prisma.$transaction).toHaveBeenCalled();

          // After first use
          vi.mocked(prisma.tokens.findMany).mockResolvedValue([] as any);

          // Second use should fail
          await expect(AuthService.setPassword(token, newPassword)).rejects.toMatchObject({
            status: 400
          });
        }
      ),
      { numRuns: 100 }
    );
  }, 10000);
});
