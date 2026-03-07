import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto as SignInDto } from './dtos/sign-in.dto';
import { SignUpDto as SignUpDto } from './dtos/sign-up.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

export const REFRESH_TOKEN_KEY = 'refreshToken';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sign-in')
  async signIn(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignInDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.signIn(dto);

    response.cookie(REFRESH_TOKEN_KEY, refreshToken, {
      maxAge:
        +this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL') * 1000,
      secure: true,
    });

    return { accessToken };
  }

  @Post('sign-up')
  async signUp(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignUpDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.signUp(dto);

    response.cookie(REFRESH_TOKEN_KEY, refreshToken, {
      maxAge:
        +this.configService.getOrThrow<number>('REFRESH_TOKEN_TTL') * 1000,
      secure: true,
    });

    return { accessToken };
  }

  @Post('logout')
  logOut() {
    //TODO get actual token from cookies
    const refreshToken = '';

    return this.authService.logOut(refreshToken);
  }
}
