import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { Socket } from 'socket.io';

import type { SocketData } from '@/guards';
import type { UserPayload } from '@/modules';

export const WsUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload => {
    const client = ctx.switchToWs().getClient<Socket>();
    return (client.data as SocketData).user;
  },
);
