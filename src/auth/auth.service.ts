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

  async signIn(dto: SignInDto): Promise<TokensResponse> {
    const user = await this.usersService.findByNickname(dto.nickname);

    if (!isDefined(user) || user.password !== dto.password) {
      throw new UnauthorizedException('Credentials are incorrect!');
    }

    const accessPayload = {
      sub: user.id,
      role: user.role,
    } satisfies JwtAccessTokenPayload;
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this._accessTokenTtl,
    });

    const refreshId = uuidv7();
    const refreshPayload = {
      sub: user.id,
      jti: refreshId,
    } satisfies JwtRefreshTokenPayload;

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this._refreshTokenTtl,
    });

    await this.prismaService.refreshToken.create({
      data: {
        id: refreshId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + this._refreshTokenTtl),
        userId: user.id,
      },
    });

    return { accessToken, refreshToken };
  }

  async signUp(dto: SignUpDto): Promise<TokensResponse> {
    const user = await this.usersService.create(dto);

    const accessPayload = {
      sub: user.id,
      role: user.role,
    } satisfies JwtAccessTokenPayload;
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this._accessTokenTtl,
    });

    const refreshId = uuidv7();
    const refreshPayload = {
      sub: user.id,
      jti: refreshId,
    } satisfies JwtRefreshTokenPayload;

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this._refreshTokenTtl,
    });

    await this.prismaService.refreshToken.create({
      data: {
        id: refreshId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + this._refreshTokenTtl),
        userId: user.id,
      },
    });

    return { accessToken, refreshToken };
  }

  logOut(): void {}
}
