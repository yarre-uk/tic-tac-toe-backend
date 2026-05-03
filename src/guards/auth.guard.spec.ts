import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';

import { JwtAuthGuard } from './auth.guard';

import { Role } from '@/generated/prisma/enums';
import type { UserPayload } from '@/modules/auth/auth.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a minimal ExecutionContext whose HTTP request has the given headers.
 * Returns the request object too so individual tests can inspect mutations (e.g. request['user']).
 */
function createContext(authHeader?: string): {
  ctx: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    headers: { authorization: authHeader },
  };

  const ctx = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { ctx, request };
}

// ─── Test data ───────────────────────────────────────────────────────────────

const VALID_TOKEN = 'valid.bearer.token';

const VALID_PAYLOAD: UserPayload = {
  sub: 'user-id-abc',
  jti: 'jti-abc123',
  role: Role.User,
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwt: { verify: jest.Mock };
  let mockReflector: { getAllAndOverride: jest.Mock };
  let mockRedis: { exists: jest.Mock };

  beforeEach(() => {
    mockJwt = { verify: jest.fn().mockReturnValue(VALID_PAYLOAD) };
    mockReflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    mockRedis = { exists: jest.fn().mockResolvedValue(0) };

    guard = new JwtAuthGuard(
      mockJwt as unknown as JwtService,
      mockReflector as unknown as Reflector,
      mockRedis as unknown as Redis,
    );
  });

  // ─── @IsPublic() routes ──────────────────────────────────────────────────

  describe('when the route is decorated with @IsPublic()', () => {
    it('should allow access without touching the token or Redis', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const { ctx } = createContext(); // no auth header needed

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockJwt.verify).not.toHaveBeenCalled();
      expect(mockRedis.exists).not.toHaveBeenCalled();
    });
  });

  // ─── Missing token ───────────────────────────────────────────────────────

  describe('when no Authorization header is present', () => {
    it('should throw UnauthorizedException', async () => {
      const { ctx } = createContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('No token provided!'),
      );
    });
  });

  // ─── Invalid / expired JWT ───────────────────────────────────────────────

  describe('when the JWT is malformed or expired', () => {
    it('should throw UnauthorizedException', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const { ctx } = createContext(`Bearer bad.token`);

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('Provided token is invalid!'),
      );
    });
  });

  // ─── Blacklisted token ───────────────────────────────────────────────────

  describe('when the token JTI is present in the Redis blacklist', () => {
    it('should throw UnauthorizedException with a revoked message', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const { ctx } = createContext(`Bearer ${VALID_TOKEN}`);

      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new UnauthorizedException('Token has been revoked!'),
      );
    });

    it('should check the blacklist key derived from the token JTI', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const { ctx } = createContext(`Bearer ${VALID_TOKEN}`);

      await guard.canActivate(ctx).catch(() => {});

      expect(mockRedis.exists).toHaveBeenCalledWith(
        `blacklist:${VALID_PAYLOAD.jti}`,
      );
    });
  });

  // ─── Valid token ─────────────────────────────────────────────────────────

  describe('when the token is valid and not blacklisted', () => {
    it('should return true', async () => {
      const { ctx } = createContext(`Bearer ${VALID_TOKEN}`);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should attach the decoded payload to request["user"]', async () => {
      const { ctx, request } = createContext(`Bearer ${VALID_TOKEN}`);

      await guard.canActivate(ctx);

      expect(request['user']).toEqual(VALID_PAYLOAD);
    });

    it('should strip the "Bearer " prefix before verifying', async () => {
      const { ctx } = createContext(`Bearer ${VALID_TOKEN}`);

      await guard.canActivate(ctx);

      expect(mockJwt.verify).toHaveBeenCalledWith(VALID_TOKEN);
    });
  });
});
