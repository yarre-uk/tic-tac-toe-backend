import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Response } from 'express';

import type { UserPayload } from '@/modules/auth/auth.service';

export const User = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<Response>();
    return request['user'] as UserPayload;
  },
);
