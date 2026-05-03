import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import Redis from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { UsersService } from '../users';

import { SignInDto, SignUpDto, ChangePasswordDto } from './dtos';

import { Role } from '@/generated/prisma/enums';
import { ApiConfigService, PrismaService } from '@/libs';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { isDefined } from '@/utils';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserPayload {
  sub: string;
  jti: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const DUMMY_PASSWORD_HASH =
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly bcryptRounds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
    private readonly configService: ApiConfigService,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {
    this.accessTokenTtl = +this.configService.get('ACCESS_TOKEN_TTL');
    this.refreshTokenTtl = +this.configService.get('REFRESH_TOKEN_TTL');
    this.bcryptRounds = this.configService.get('BCRYPT_ROUNDS');
  }

  async issueTokens(userId: string, role: Role): Promise<TokensResponse> {
    const accessId = uuidv7();
    const accessPayload = {
      sub: userId,
      role,
      jti: accessId,
    } satisfies UserPayload;
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessTokenTtl,
    });

    const refreshId = uuidv7();
    const refreshPayload = {
      sub: userId,
      jti: refreshId,
    } satisfies RefreshTokenPayload;

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.refreshTokenTtl,
    });

    await this.prismaService.refreshToken.create({
      data: {
        id: refreshId,
        accessTokenJti: accessId,
        expiresAt: new Date(Date.now() + this.refreshTokenTtl * 1000),
        userId: userId,
      },
    });

    return { accessToken, refreshToken };
  }

  private _accessTokenRemainingTtl(createdAt: Date): number {
    return Math.max(
      0,
      Math.floor(
        (createdAt.getTime() + this.accessTokenTtl * 1000 - Date.now()) / 1000,
      ),
    );
  }

  async signIn(dto: SignInDto): Promise<TokensResponse> {
    const user = await this.usersService.findByNickname(dto.nickname);

    const isPasswordCorrect = await compare(
      dto.password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!isDefined(user) || !isPasswordCorrect) {
      throw new UnauthorizedException('Credentials are incorrect!');
    }

    return this.issueTokens(user.id, user.role);
  }

  async signUp(dto: SignUpDto): Promise<TokensResponse> {
    const hashedPassword = await hash(dto.password, this.bcryptRounds);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.issueTokens(user.id, user.role);
  }

  async logOut(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Provided token is invalid!');
    }

    const stored = await this.prismaService.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!isDefined(stored)) {
      throw new UnauthorizedException('Token not found');
    }

    if (!stored.isActive) {
      throw new UnauthorizedException('Token already revoked');
    }

    await this.prismaService.refreshToken.update({
      where: { id: payload.jti },
      data: { isActive: false },
    });

    const ttl = this._accessTokenRemainingTtl(stored.createdAt);
    if (ttl > 0) {
      await this.redis.set(
        `blocklist:${stored.accessTokenJti}`,
        '1',
        'EX',
        ttl,
      );
    }
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Provided token is invalid!');
    }

    const stored = await this.prismaService.refreshToken.findUnique({
      where: { id: payload.jti },
      include: {
        user: true,
      },
    });

    if (!isDefined(stored)) {
      throw new UnauthorizedException('Token not found');
    }

    if (!stored.isActive) {
      throw new UnauthorizedException('Token already revoked');
    }

    await this.prismaService.refreshToken.update({
      where: { id: payload.jti },
      data: { isActive: false },
    });

    return this.issueTokens(stored.user.id, stored.user.role);
  }

  getSessions(userId: string) {
    return this.prismaService.refreshToken.findMany({
      where: { userId },
      select: { id: true, expiresAt: true, createdAt: true, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prismaService.refreshToken.findUnique({
      where: { id: sessionId },
    });

    if (!isDefined(session) || session.userId !== userId) {
      throw new UnauthorizedException('Session not found');
    }

    await this.prismaService.refreshToken.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    const ttl = this._accessTokenRemainingTtl(session.createdAt);
    if (ttl > 0) {
      await this.redis.set(
        `blacklist:${session.accessTokenJti}`,
        '1',
        'EX',
        ttl,
      );
    }
  }

  async revokeAllSessions(userId: string, exceptJti?: string) {
    const sessions = await this.prismaService.refreshToken.findMany({
      where: {
        userId,
        isActive: true,
        ...(exceptJti ? { id: { not: exceptJti } } : {}),
      },
      select: { id: true, accessTokenJti: true, createdAt: true },
    });

    await this.prismaService.refreshToken.updateMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      data: { isActive: false },
    });

    if (sessions.length > 0) {
      const pipeline = this.redis.pipeline();

      sessions.forEach((s) => {
        const ttl = this._accessTokenRemainingTtl(s.createdAt);
        if (ttl > 0) {
          pipeline.set(`blacklist:${s.accessTokenJti}`, '1', 'EX', ttl);
        }
      });

      await pipeline.exec();
    }
  }

  async changePassword(dto: ChangePasswordDto) {
    const user = await this.usersService.findByNickname(dto.nickname);

    const isPasswordCorrect = await compare(
      dto.oldPassword,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!isDefined(user) || !isPasswordCorrect) {
      throw new UnauthorizedException('Credentials are incorrect!');
    }

    const newPasswordHashed = await hash(dto.newPassword, this.bcryptRounds);

    await this.usersService.update(user.id, {
      password: newPasswordHashed,
    });

    await this.prismaService.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });
  }
}
