import { Controller, Delete, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@/generated/prisma/enums';
import { RequiresRole } from '@/guards';
import { User } from '@/decorators';
import { AuthService } from './auth.service';
import type { UserPayload } from './auth.service';
import { REFRESH_TOKEN_KEY } from './auth.controller';

@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getSessions(@User() user: UserPayload) {
    return this.authService.getSessions(user.sub);
  }

  @Delete()
  revokeAllSessions(@User() user: UserPayload, @Req() request: Request) {
    const currentJti = (request.cookies[REFRESH_TOKEN_KEY] as
      | string
      | undefined)
      ? user.jti
      : undefined;

    return this.authService.revokeAllSessions(user.sub, currentJti);
  }

  @Delete(':id')
  revokeSession(@User() user: UserPayload, @Param('id') id: string) {
    return this.authService.revokeSession(id, user.sub);
  }

  @RequiresRole(Role.Admin)
  @Get('admin/:userId')
  getSessionsAdmin(@Param('userId') userId: string) {
    return this.authService.getSessions(userId);
  }

  @RequiresRole(Role.Admin)
  @Delete('admin/:userId')
  revokeAllSessionsAdmin(@Param('userId') userId: string) {
    return this.authService.revokeAllSessions(userId);
  }
}
