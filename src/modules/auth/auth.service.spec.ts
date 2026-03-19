/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { v7 as uuidv7 } from 'uuid';
import { AuthService } from './auth.service';
import { UsersService } from '../users';
import { PrismaService } from '@/libs';
import { ApiConfigService } from '@/libs';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { Role } from '@/generated/prisma/enums';

// ─── Module-level mocks (hoisted by Jest before imports) ─────────────────────

jest.mock('bcrypt');
jest.mock('uuid', () => ({ v7: jest.fn() }));

// ─── Test constants ───────────────────────────────────────────────────────────

const USER_ID = 'user-id-abc123';
const ACCESS_JTI = 'access-jti-111';
const REFRESH_JTI = 'refresh-jti-222';
const ACCESS_TOKEN = 'mock.access.token';
const REFRESH_TOKEN = 'mock.refresh.token';
const NICKNAME = 'testuser';
const RAW_PASSWORD = 'Str0ng!Pass';
const HASHED_PASSWORD = '$2b$10$mockhash';

const mockUser = {
  id: USER_ID,
  nickname: NICKNAME,
  email: 'test@example.com',
  password: HASHED_PASSWORD,
  role: Role.User,
};

/**
 * Factory for refresh token DB records.
 * Default `createdAt` is "now", giving a remaining TTL > 0 with a 900s access token TTL.
 * Pass `createdAt: new Date(Date.now() - 1_000_000)` to simulate an expired access token.
 */
const makeTokenRecord = (overrides: object = {}) => ({
  id: REFRESH_JTI,
  accessTokenJti: ACCESS_JTI,
  expiresAt: new Date(Date.now() + 604_800_000),
  createdAt: new Date(),
  isActive: true,
  userId: USER_ID,
  ...overrides,
});

// ─── Shared mock objects (recreated fresh in beforeEach) ──────────────────────

let mockPipeline: { set: jest.Mock; exec: jest.Mock };
let mockRedis: { set: jest.Mock; exists: jest.Mock; pipeline: jest.Mock };
let mockJwt: { sign: jest.Mock; verify: jest.Mock };
let mockUsers: {
  findByNickname: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
let mockPrisma: {
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset all module-level mocks between tests
    jest.clearAllMocks();

    // uuidv7 is called twice inside _createTokens: first for the access JTI, then the refresh JTI
    (uuidv7 as jest.Mock)
      .mockReturnValueOnce(ACCESS_JTI)
      .mockReturnValueOnce(REFRESH_JTI);

    mockPipeline = {
      set: jest.fn().mockReturnThis(), // chainable
      exec: jest.fn().mockResolvedValue([]),
    };

    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      exists: jest.fn().mockResolvedValue(0),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    };

    mockJwt = {
      // _createTokens calls sign twice: once for access, once for refresh
      sign: jest
        .fn()
        .mockReturnValueOnce(ACCESS_TOKEN)
        .mockReturnValueOnce(REFRESH_TOKEN),
      verify: jest.fn(),
    };

    mockUsers = {
      findByNickname: jest.fn().mockResolvedValue(mockUser),
      create: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(mockUser),
    };

    mockPrisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue(makeTokenRecord()),
        findUnique: jest.fn().mockResolvedValue(makeTokenRecord()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(makeTokenRecord()),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwt },
        { provide: UsersService, useValue: mockUsers },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ApiConfigService,
          useValue: {
            get: jest.fn(
              (key: string) =>
                ({
                  ACCESS_TOKEN_TTL: '900',
                  REFRESH_TOKEN_TTL: '604800',
                  BCRYPT_ROUNDS: 10,
                })[key],
            ),
          },
        },
        { provide: REDIS_CLIENT_KEY, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── signIn ──────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('should return access and refresh tokens when credentials are correct', async () => {
      (compare as jest.Mock).mockResolvedValue(true);

      const result = await service.signIn({
        nickname: NICKNAME,
        password: RAW_PASSWORD,
      });

      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
      expect(mockUsers.findByNickname).toHaveBeenCalledWith(NICKNAME);
      expect(compare).toHaveBeenCalledWith(RAW_PASSWORD, HASHED_PASSWORD);
    });

    it('should persist a refresh token record in the database', async () => {
      (compare as jest.Mock).mockResolvedValue(true);

      await service.signIn({ nickname: NICKNAME, password: RAW_PASSWORD });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        }),
      );
    });

    it('should throw UnauthorizedException when the password is incorrect', async () => {
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.signIn({ nickname: NICKNAME, password: 'wrong' }),
      ).rejects.toThrow(
        new UnauthorizedException('Credentials are incorrect!'),
      );
    });

    it('should propagate the exception from UsersService when the user is not found', async () => {
      mockUsers.findByNickname.mockRejectedValue(new NotFoundException());

      await expect(
        service.signIn({ nickname: 'ghost', password: RAW_PASSWORD }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── signUp ──────────────────────────────────────────────────────────────

  describe('signUp', () => {
    it('should hash the password before creating the user', async () => {
      (hash as jest.Mock).mockResolvedValue(HASHED_PASSWORD);

      const dto = {
        nickname: NICKNAME,
        password: RAW_PASSWORD,
        email: undefined,
      };
      await service.signUp(dto);

      expect(hash).toHaveBeenCalledWith(RAW_PASSWORD, 10);
      expect(mockUsers.create).toHaveBeenCalledWith({
        ...dto,
        password: HASHED_PASSWORD,
      });
    });

    it('should return access and refresh tokens after creating the user', async () => {
      (hash as jest.Mock).mockResolvedValue(HASHED_PASSWORD);

      const result = await service.signUp({
        nickname: NICKNAME,
        password: RAW_PASSWORD,
      });

      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });
  });

  // ─── logOut ──────────────────────────────────────────────────────────────

  describe('logOut', () => {
    beforeEach(() => {
      mockJwt.verify.mockReturnValue({ sub: USER_ID, jti: REFRESH_JTI });
    });

    it('should mark the refresh token as inactive', async () => {
      await service.logOut(REFRESH_TOKEN);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: REFRESH_JTI },
        data: { isActive: false },
      });
    });

    it('should add the access token to the Redis blocklist when TTL is still positive', async () => {
      // createdAt = now → remaining TTL ≈ 900s > 0
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ createdAt: new Date() }),
      );

      await service.logOut(REFRESH_TOKEN);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `blocklist:${ACCESS_JTI}`,
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should NOT touch Redis when the access token TTL has already expired', async () => {
      // createdAt was 1000s ago, accessTokenTtl is 900s → remaining TTL = -100s → clamped to 0
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ createdAt: new Date(Date.now() - 1_000_000) }),
      );

      await service.logOut(REFRESH_TOKEN);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the provided JWT is invalid', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.logOut('bad.token')).rejects.toThrow(
        new UnauthorizedException('Provided token is invalid!'),
      );
    });

    it('should throw UnauthorizedException when the token record is not found in the DB', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.logOut(REFRESH_TOKEN)).rejects.toThrow(
        new UnauthorizedException('Token not found'),
      );
    });

    it('should throw UnauthorizedException when the token is already revoked', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ isActive: false }),
      );

      await expect(service.logOut(REFRESH_TOKEN)).rejects.toThrow(
        new UnauthorizedException('Token already revoked'),
      );
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const tokenWithUser = { ...makeTokenRecord(), user: mockUser };

    beforeEach(() => {
      mockJwt.verify.mockReturnValue({ sub: USER_ID, jti: REFRESH_JTI });
      mockPrisma.refreshToken.findUnique.mockResolvedValue(tokenWithUser);
    });

    it('should revoke the old refresh token and return a new token pair', async () => {
      const result = await service.refresh(REFRESH_TOKEN);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: REFRESH_JTI },
        data: { isActive: false },
      });
      expect(result).toEqual({
        accessToken: ACCESS_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    });

    it('should throw UnauthorizedException when the provided JWT is invalid', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('bad.token')).rejects.toThrow(
        new UnauthorizedException('Provided token is invalid!'),
      );
    });

    it('should throw UnauthorizedException when the token record is not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(
        new UnauthorizedException('Token not found'),
      );
    });

    it('should throw UnauthorizedException when the token is already revoked', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        ...tokenWithUser,
        isActive: false,
      });

      await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(
        new UnauthorizedException('Token already revoked'),
      );
    });
  });

  // ─── getSessions ─────────────────────────────────────────────────────────

  describe('getSessions', () => {
    it('should return sessions ordered by createdAt descending', async () => {
      const sessions = [makeTokenRecord()];
      mockPrisma.refreshToken.findMany.mockResolvedValue(sessions);

      const result = await service.getSessions(USER_ID);

      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { id: true, expiresAt: true, createdAt: true, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(sessions);
    });
  });

  // ─── revokeSession ───────────────────────────────────────────────────────

  describe('revokeSession', () => {
    it('should mark the session inactive and add the access token to the Redis blacklist', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ createdAt: new Date() }),
      );

      await service.revokeSession(REFRESH_JTI, USER_ID);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: REFRESH_JTI },
        data: { isActive: false },
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        `blacklist:${ACCESS_JTI}`,
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should NOT touch Redis when the access token TTL has already expired', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ createdAt: new Date(Date.now() - 1_000_000) }),
      );

      await service.revokeSession(REFRESH_JTI, USER_ID);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when the session does not exist', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeSession('nonexistent-id', USER_ID),
      ).rejects.toThrow(new UnauthorizedException('Session not found'));
    });

    it('should throw UnauthorizedException when the session belongs to a different user', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(
        makeTokenRecord({ userId: 'other-user-id' }),
      );

      await expect(service.revokeSession(REFRESH_JTI, USER_ID)).rejects.toThrow(
        new UnauthorizedException('Session not found'),
      );
    });
  });

  // ─── revokeAllSessions ───────────────────────────────────────────────────

  describe('revokeAllSessions', () => {
    it('should mark all active sessions inactive and pipeline their access tokens into Redis', async () => {
      const sessions = [
        { id: REFRESH_JTI, accessTokenJti: ACCESS_JTI, createdAt: new Date() },
      ];
      mockPrisma.refreshToken.findMany.mockResolvedValue(sessions);

      await service.revokeAllSessions(USER_ID);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [REFRESH_JTI] } },
        data: { isActive: false },
      });
      expect(mockPipeline.set).toHaveBeenCalledWith(
        `blacklist:${ACCESS_JTI}`,
        '1',
        'EX',
        expect.any(Number),
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should exclude the specified JTI from the revocation query', async () => {
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);

      await service.revokeAllSessions(USER_ID, ACCESS_JTI);

      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: ACCESS_JTI } }),
        }),
      );
    });

    it('should skip the Redis pipeline entirely when there are no active sessions', async () => {
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);

      await service.revokeAllSessions(USER_ID);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });

    it('should skip a session entry in the pipeline when its access token TTL has expired', async () => {
      const sessions = [
        {
          id: REFRESH_JTI,
          accessTokenJti: ACCESS_JTI,
          createdAt: new Date(Date.now() - 1_000_000), // expired
        },
      ];
      mockPrisma.refreshToken.findMany.mockResolvedValue(sessions);

      await service.revokeAllSessions(USER_ID);

      // Pipeline was created but no set() was called for this entry
      expect(mockPipeline.set).not.toHaveBeenCalled();
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  // ─── changePassword ──────────────────────────────────────────────────────

  describe('changePassword', () => {
    const dto = {
      nickname: NICKNAME,
      oldPassword: RAW_PASSWORD,
      newPassword: 'NewStr0ng!Pass',
    };

    it('should hash the new password, update it, and revoke all refresh tokens', async () => {
      (compare as jest.Mock).mockResolvedValue(true);
      (hash as jest.Mock).mockResolvedValue('$2b$10$newhash');

      await service.changePassword(dto);

      expect(compare).toHaveBeenCalledWith(RAW_PASSWORD, HASHED_PASSWORD);
      expect(hash).toHaveBeenCalledWith('NewStr0ng!Pass', 10);
      expect(mockUsers.update).toHaveBeenCalledWith(USER_ID, {
        password: '$2b$10$newhash',
      });
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        data: { isActive: false },
      });
    });

    it('should throw UnauthorizedException when the old password is incorrect', async () => {
      (compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword(dto)).rejects.toThrow(
        new UnauthorizedException('Credentials are incorrect!'),
      );
      expect(mockUsers.update).not.toHaveBeenCalled();
    });

    it('should propagate the exception from UsersService when the user is not found', async () => {
      mockUsers.findByNickname.mockRejectedValue(new NotFoundException());

      await expect(service.changePassword(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
