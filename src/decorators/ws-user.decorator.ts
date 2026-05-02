import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { UserPayload } from '@/modules';
import { SocketData } from '@/guards';

// The WS equivalent of the HTTP @User() decorator.
//
// In HTTP handlers we read the payload from request['user'].
// In WS handlers we read it from client.data.user — the same value
// that WsAuthGuard wrote after verifying the JWT.
//
// Usage in a gateway method:
//   @SubscribeMessage('room:join')
//   handleJoin(@WsUser() user: UserPayload, @MessageBody() body: JoinRoomDto) { ... }
export const WsUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload => {
    const client = ctx.switchToWs().getClient<Socket>();
    // Cast to SocketData so TypeScript knows the shape of client.data
    // instead of treating it as `any`.
    return (client.data as SocketData).user;
  },
);
