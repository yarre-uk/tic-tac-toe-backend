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
  // The raw JWT stored here after first verification so the guard can re-verify
  // it on every message. When auth:refresh runs, both token and user are replaced,
  // so expiry is always caught on the next message regardless of which token is active.
  token: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    // Same Redis injection as JwtAuthGuard — we need the blacklist check
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const data = client.data as SocketData;

    // Resolve the token to verify: prefer the one stored in client.data because
    // it may have been updated by auth:refresh. Fall back to the handshake token
    // on the first message when client.data.token hasn't been written yet.
    const token = data.token ?? this.extractToken(client);

    if (!isDefined(token)) {
      throw new WsException('No token provided');
    }

    let payload: UserPayload;

    try {
      // Re-verify on every message so token expiry is always caught, regardless
      // of whether auth:refresh has run or not.
      payload = this.jwtService.verify<UserPayload>(token);
    } catch {
      throw new WsException('Token is invalid or expired');
    }

    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new WsException('Token has been revoked');
    }

    // Write (or refresh) both the token string and the decoded payload.
    // auth:refresh in AuthGateway does the same write, so after a token swap
    // the next message here picks up the new token from client.data.token.
    data.token = token;
    data.user = payload;

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
