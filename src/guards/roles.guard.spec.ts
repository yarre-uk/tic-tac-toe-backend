import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '@/generated/prisma/enums';
import type { UserPayload } from '@/modules/auth/auth.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createContext(user?: UserPayload): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (user) request['user'] = user;

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makePayload(role: Role): UserPayload {
  return { sub: 'user-id', jti: 'jti-abc', role };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    mockReflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  // ─── No role requirement ──────────────────────────────────────────────────

  describe('when the route has no @RequiresRole() decorator', () => {
    it('should allow access regardless of the user role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      expect(guard.canActivate(createContext(makePayload(Role.User)))).toBe(
        true,
      );
    });
  });

  // ─── Role hierarchy: User (1) < Moderator (2) < Admin (3) ────────────────

  describe('role-based access decisions', () => {
    it('should allow a User to access a User-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.User);

      expect(guard.canActivate(createContext(makePayload(Role.User)))).toBe(
        true,
      );
    });

    it('should allow a Moderator to access a User-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.User);

      expect(
        guard.canActivate(createContext(makePayload(Role.Moderator))),
      ).toBe(true);
    });

    it('should allow an Admin to access a User-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.User);

      expect(guard.canActivate(createContext(makePayload(Role.Admin)))).toBe(
        true,
      );
    });

    it('should allow a Moderator to access a Moderator-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Moderator);

      expect(
        guard.canActivate(createContext(makePayload(Role.Moderator))),
      ).toBe(true);
    });

    it('should allow an Admin to access a Moderator-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Moderator);

      expect(guard.canActivate(createContext(makePayload(Role.Admin)))).toBe(
        true,
      );
    });

    it('should deny a User access to a Moderator-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Moderator);

      expect(guard.canActivate(createContext(makePayload(Role.User)))).toBe(
        false,
      );
    });

    it('should deny a Moderator access to an Admin-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Admin);

      expect(
        guard.canActivate(createContext(makePayload(Role.Moderator))),
      ).toBe(false);
    });

    it('should deny a User access to an Admin-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Admin);

      expect(guard.canActivate(createContext(makePayload(Role.User)))).toBe(
        false,
      );
    });

    it('should allow an Admin to access an Admin-level route', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.Admin);

      expect(guard.canActivate(createContext(makePayload(Role.Admin)))).toBe(
        true,
      );
    });
  });

  // ─── Guard precondition failures ─────────────────────────────────────────

  describe('when the request is missing a user object', () => {
    it('should throw InternalServerErrorException (JwtAuthGuard should have run first)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(Role.User);
      const ctx = createContext(); // no user attached

      expect(() => guard.canActivate(ctx)).toThrow(
        InternalServerErrorException,
      );
    });
  });
});
