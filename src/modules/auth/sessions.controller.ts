import { Controller, Delete, Get, HttpCode, Param, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '@/generated/prisma/enums';
import { RequiresRole } from '@/guards';
import { User } from '@/decorators';
import { AuthService } from './auth.service';
import type { UserPayload } from './auth.service';
import { REFRESH_TOKEN_KEY } from './auth.controller';
import { SessionResponseDto } from './dtos';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get all sessions for the current user' })
  @ApiOkResponse({ type: [SessionResponseDto] })
  @Get()
  getSessions(@User() user: UserPayload) {
    return this.authService.getSessions(user.sub);
  }

  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete()
  revokeAllSessions(@User() user: UserPayload, @Req() request: Request) {
    const currentJti = (request.cookies[REFRESH_TOKEN_KEY] as
      | string
      | undefined)
      ? user.jti
      : undefined;

    return this.authService.revokeAllSessions(user.sub, currentJti);
  }

  @ApiOperation({ summary: 'Revoke a specific session by ID' })
  @ApiNoContentResponse()
  @ApiParam({ name: 'id', description: 'Session (refresh token) ID' })
  @HttpCode(204)
  @Delete(':id')
  revokeSession(@User() user: UserPayload, @Param('id') id: string) {
    return this.authService.revokeSession(id, user.sub);
  }

  @ApiOperation({ summary: '[Admin] Get all sessions for a user' })
  @ApiOkResponse({ type: [SessionResponseDto] })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  @RequiresRole(Role.Admin)
  @Get('admin/:userId')
  getSessionsAdmin(@Param('userId') userId: string) {
    return this.authService.getSessions(userId);
  }

  @ApiOperation({ summary: '[Admin] Revoke all sessions for a user' })
  @ApiNoContentResponse()
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  @HttpCode(204)
  @RequiresRole(Role.Admin)
  @Delete('admin/:userId')
  revokeAllSessionsAdmin(@Param('userId') userId: string) {
    return this.authService.revokeAllSessions(userId);
  }
}
