import { UserPayload } from '@/modules/auth/auth.service';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';

export const User = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest<Response>();
    return request['user'];
  },
);
