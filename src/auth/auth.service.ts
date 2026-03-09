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
import { hash, compare } from 'bcrypt';
import { ChangePasswordDto } from './dtos/change-password.dtp';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const DUMMY_PASSWORD_HASH =
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
    private readonly configService: ConfigService,
  ) {
    this.accessTokenTtl =
      +this.configService.getOrThrow<number>('ACCESS_TOKEN_TTL');
    this.refreshTokenTtl =
      +this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL');
    this.bcryptRounds = +this.configService.get<number>('BCRYPT_ROUNDS', 10);
  }

  private async _createTokens(
    userId: string,
    role: Role,
  ): Promise<TokensResponse> {
    const accessPayload = {
      sub: userId,
      role,
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
        expiresAt: new Date(Date.now() + this.refreshTokenTtl * 1000),
        userId: userId,
      },
    });

    return { accessToken, refreshToken };
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

    return this._createTokens(user.id, user.role);
  }

  async signUp(dto: SignUpDto): Promise<TokensResponse> {
    const hashedPassword = await hash(dto.password, this.bcryptRounds);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    return this._createTokens(user.id, user.role);
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

    return this._createTokens(stored.user.id, stored.user.role);
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
