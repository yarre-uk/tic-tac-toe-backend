import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import Redis from 'ioredis';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { SocketData } from '@/guards';
import type { UserPayload } from './auth.service';
import { isDefined } from '@/utils';

// This gateway lives on the same namespace as RoomsGateway ('/ws').
// NestJS merges all gateways that share a namespace onto the same Socket.IO
// server, so clients use the exact same socket connection for both.
//
// No @UseGuards here by design — the whole point is to let a client with an
// expired token (which WsAuthGuard would reject) swap in a fresh one without
// having to disconnect and reconnect (which would trigger the room leave logic).
@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class AuthGateway {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  // auth:refresh — update the socket's stored user payload after the client
  // has obtained a new access token from the REST POST /auth/refresh endpoint.
  //
  // Flow:
  //   1. Client receives 'exception' { message: 'Token is invalid or expired' }
  //      because WsAuthGuard rejected their message.
  //   2. Client calls REST POST /auth/refresh → receives a new accessToken.
  //   3. Client sends 'auth:refresh' on the same socket with the new token.
  //   4. We verify it here and write the new payload to client.data.user.
  //   5. Client retries the original room event — WsAuthGuard now passes because
  //      it re-reads the token from client.handshake, which the client should
  //      have updated on their side, OR the guard reads client.data.user directly.
  //
  // Note: WsAuthGuard reads the token from client.handshake (set at connect time)
  // and re-verifies on every message. After a token refresh the handshake token
  // is still the old one, so we ALSO update client.data.user here. That way
  // downstream decorators like @WsUser() return the refreshed payload immediately.
  // For the guard to use the new token going forward the client must reconnect —
  // but thanks to the 60-second grace period in RoomsGateway, reconnection
  // preserves room membership.
  @SubscribeMessage('auth:refresh')
  async handleRefresh(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { token: string },
  ) {
    // Strip the "Bearer " prefix if the client sends it that way.
    const raw = body?.token?.replace('Bearer ', '').trim();

    if (!isDefined(raw)) {
      throw new WsException('No token provided');
    }

    let payload: UserPayload;

    try {
      payload = this.jwtService.verify<UserPayload>(raw);
    } catch {
      throw new WsException('Token is invalid or expired');
    }

    // Same blacklist check as WsAuthGuard and JwtAuthGuard — a revoked token
    // must not be accepted here either.
    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new WsException('Token has been revoked');
    }

    // Overwrite both the stored token string and the decoded payload.
    // WsAuthGuard reads client.data.token on every subsequent message, so after
    // this write the guard will verify the new token and catch its expiry too.
    const data = client.data as SocketData;
    data.token = raw;
    data.user = payload;

    return { event: 'auth:refreshed' };
  }
}
