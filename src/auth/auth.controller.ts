import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto as SignInDto } from './dtos/sign-in.dto';
import { SignUpDto as SignUpDto } from './dtos/sign-up.dto';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { isDefined } from '@/utils';

export const REFRESH_TOKEN_KEY = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private _setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_KEY, refreshToken, {
      maxAge:
        +this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL') * 1000,
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
    });
  }

  @Post('sign-in')
  async signIn(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignInDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.signIn(dto);

    this._setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @Post('sign-up')
  async signUp(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignUpDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.signUp(dto);

    this._setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @Post('logout')
  async logOut(
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const refreshToken = request.cookies[REFRESH_TOKEN_KEY] as
      | string
      | undefined;

    if (!isDefined(refreshToken)) {
      throw new UnauthorizedException('No token provided!');
    }

    await this.authService.logOut(refreshToken);

    response.clearCookie(REFRESH_TOKEN_KEY);

    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  async refresh(
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ) {
    const refreshToken = request.cookies[REFRESH_TOKEN_KEY] as
      | string
      | undefined;

    if (!isDefined(refreshToken)) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken);

    this._setRefreshTokenCookie(response, newRefreshToken);

    return { accessToken };
  }
}
