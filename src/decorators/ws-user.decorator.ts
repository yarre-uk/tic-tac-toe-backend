import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { UserPayload } from '@/modules';
import { SocketData } from '@/guards';

export const WsUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload => {
    const client = ctx.switchToWs().getClient<Socket>();
    return (client.data as SocketData).user;
  },
);
