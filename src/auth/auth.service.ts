import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignInDto } from './dtos/sign-in.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { Role } from '@/generated/prisma/enums';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@/users/users.service';
import { isDefined } from '@/utils';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '@/services/prisma.client';
import { ConfigService } from '@nestjs/config';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAccessTokenPayload {
  sub: string;
  role: Role;
}

export interface JwtRefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly _accessTokenTtl: number;
  private readonly _refreshTokenTtl: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this._accessTokenTtl =
      +this.configService.getOrThrow<number>('ACCESS_TOKEN_TTL');
    this._refreshTokenTtl =
      +this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL');
  }

  private async _createTokens(
    userId: string,
    role: Role,
  ): Promise<TokensResponse> {
    const accessPayload = {
      sub: userId,
      role,
    } satisfies JwtAccessTokenPayload;
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this._accessTokenTtl,
    });

    const refreshId = uuidv7();
    const refreshPayload = {
      sub: userId,
      jti: refreshId,
    } satisfies JwtRefreshTokenPayload;

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this._refreshTokenTtl,
    });

    await this.prismaService.refreshToken.create({
      data: {
        id: refreshId,
        expiresAt: new Date(Date.now() + this._refreshTokenTtl * 1000),
        userId: userId,
      },
    });

    return { accessToken, refreshToken };
  }

  async signIn(dto: SignInDto): Promise<TokensResponse> {
    const user = await this.usersService.findByNickname(dto.nickname);

    if (!isDefined(user) || user.password !== dto.password) {
      throw new UnauthorizedException('Credentials are incorrect!');
    }

    return this._createTokens(user.id, user.role);
  }

  async signUp(dto: SignUpDto): Promise<TokensResponse> {
    const user = await this.usersService.create(dto);

    return this._createTokens(user.id, user.role);
  }

  async logOut(refreshToken: string): Promise<void> {
    let payload: JwtRefreshTokenPayload;

    try {
      payload = this.jwtService.verify<JwtRefreshTokenPayload>(refreshToken);
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
  }

  async refresh(refreshToken: string) {
    let payload: JwtRefreshTokenPayload;

    try {
      payload = this.jwtService.verify<JwtRefreshTokenPayload>(refreshToken);
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

    return this._createTokens(stored.user.id, stored.user.role);
  }
}
