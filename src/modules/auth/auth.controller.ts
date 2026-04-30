import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { isDefined } from '@/utils';
import { ApiConfigService } from '@/libs';
import {
  ChangePasswordDto,
  SignInDto,
  SignUpDto,
  TokenResponseDto,
} from './dtos';
import { GoogleGuard, IsPublic } from '@/guards';
import { User } from '@/generated/prisma/client';

export const REFRESH_TOKEN_KEY = 'refreshToken';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ApiConfigService,
  ) {}

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_TOKEN_KEY, refreshToken, {
      maxAge: this.configService.get('REFRESH_TOKEN_TTL') * 1000,
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
    });
  }

  @ApiOperation({ summary: 'Sign in and receive tokens' })
  @ApiOkResponse({ type: TokenResponseDto })
  @IsPublic()
  @Post('sign-in')
  async signIn(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignInDto,
  ) {
    const {
      accessToken,
      refreshToken,
    }: { accessToken: string; refreshToken: string } =
      await this.authService.signIn(dto);

    this.setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @ApiOperation({ summary: 'Register a new account' })
  @ApiOkResponse({ type: TokenResponseDto })
  @IsPublic()
  @Post('sign-up')
  async signUp(
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SignUpDto,
  ) {
    const {
      accessToken,
      refreshToken,
    }: { accessToken: string; refreshToken: string } =
      await this.authService.signUp(dto);

    this.setRefreshTokenCookie(response, refreshToken);

    return { accessToken };
  }

  @ApiOperation({ summary: 'Log out and revoke the current session' })
  @ApiNoContentResponse()
  @ApiBearerAuth()
  @ApiCookieAuth(REFRESH_TOKEN_KEY)
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

  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiCookieAuth(REFRESH_TOKEN_KEY)
  @IsPublic()
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

    const {
      accessToken,
      refreshToken: newRefreshToken,
    }: { accessToken: string; refreshToken: string } =
      await this.authService.refresh(refreshToken);

    this.setRefreshTokenCookie(response, newRefreshToken);

    return { accessToken };
  }

  @ApiOperation({ summary: 'Change password and revoke all sessions' })
  @ApiNoContentResponse()
  @ApiBearerAuth()
  @Post('change-password')
  async changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto);
  }

  @ApiOperation({ summary: 'Initiate Google OAuth2 flow' })
  @ApiFoundResponse({ description: 'Redirects to Google consent screen' })
  @IsPublic()
  @Get('google')
  @UseGuards(GoogleGuard)
  googleAuth() {}

  @ApiOperation({
    summary: 'Google OAuth2 callback — issues tokens and redirects to frontend',
  })
  @ApiFoundResponse({
    description:
      'Redirects to FRONTEND_URL/auth?token=<accessToken> and sets refreshToken cookie',
  })
  @ApiCookieAuth(REFRESH_TOKEN_KEY)
  @IsPublic()
  @Get('google/callback')
  @UseGuards(GoogleGuard)
  async googleCallback(
    @Res() response: Response,
    @Req() request: { user: User } & Request,
  ) {
    const user = request['user'] as User;
    const tokens = await this.authService.issueTokens(user.id, 'User');

    this.setRefreshTokenCookie(response, tokens.refreshToken);

    response.redirect(
      `${this.configService.get('FRONTEND_URL')}/auth?token=${tokens.accessToken}`,
    );
  }

  @ApiExcludeEndpoint()
  @IsPublic()
  @Get('/')
  devTokenCapture(@Query('token') token: string) {
    return { accessToken: token };
  }
}
