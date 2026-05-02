import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
// Socket from socket.io gives us access to the handshake object
import type { Socket } from 'socket.io';
import Redis from 'ioredis';
import { isDefined } from '@/utils';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import type { UserPayload } from '@/modules/auth/auth.service';

// Typed shape of the data we store on each socket for the lifetime of the connection.
// Socket.IO types client.data as `any`, so we define our own interface and cast to it
// wherever we read or write socket-level state.
export interface SocketData {
  user: UserPayload;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    // Same Redis injection as JwtAuthGuard — we need the blacklist check
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket context is different from HTTP.
    // Instead of switchToHttp(), we use switchToWs() to get the socket client.
    const client: Socket = context.switchToWs().getClient<Socket>();

    const token = this.extractToken(client);

    if (!isDefined(token)) {
      // WsException is the WebSocket equivalent of HttpException.
      // NestJS serialises it and emits it back to the client as an 'exception' event
      // instead of returning an HTTP 4xx response.
      throw new WsException('No token provided');
    }

    let payload: UserPayload;

    try {
      payload = this.jwtService.verify<UserPayload>(token);
    } catch {
      throw new WsException('Token is invalid or expired');
    }

    // Same blacklist check as the HTTP guard — a logged-out token must not work
    // over WebSockets either.
    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new WsException('Token has been revoked');
    }

    // Attach the decoded payload to the socket's data bag so that any handler
    // or decorator can read it later via client.data.user.
    // This is the WS equivalent of request['user'] = payload in JwtAuthGuard.
    // We cast to SocketData to avoid the `any` type that Socket.IO gives client.data.
    (client.data as SocketData).user = payload;

    return true;
  }

  private extractToken(client: Socket): string | null {
    // Socket.IO clients can send auth data in two ways:
    //
    // 1. Via the auth object (recommended — not exposed in the URL):
    //      const socket = io(url, { auth: { token: 'Bearer xxx' } })
    //
    // 2. Via the handshake query string (visible in logs/proxies — less safe):
    //      const socket = io(url, { query: { token: 'xxx' } })
    //
    // We support both and strip the "Bearer " prefix if present.
    const authHeader =
      (client.handshake.auth.token as string | undefined) ??
      (client.handshake.query.token as string | undefined);

    if (!isDefined(authHeader)) {
      return null;
    }

    return authHeader.replace('Bearer ', '');
  }
}
