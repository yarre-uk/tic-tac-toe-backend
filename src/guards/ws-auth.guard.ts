import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import Redis from 'ioredis';
import { isDefined } from '@/utils';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import type { UserPayload } from '@/modules/auth/auth.service';

export interface SocketData {
  user: UserPayload;
  token: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const data = client.data as SocketData;

    const token = data.token ?? this.extractToken(client);

    if (!isDefined(token)) {
      throw new WsException('No token provided');
    }

    let payload: UserPayload;

    try {
      payload = this.jwtService.verify<UserPayload>(token);
    } catch {
      throw new WsException('Token is invalid or expired');
    }

    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new WsException('Token has been revoked');
    }

    data.token = token;
    data.user = payload;

    return true;
  }

  private extractToken(client: Socket): string | null {
    const authHeader =
      (client.handshake.auth.token as string | undefined) ??
      (client.handshake.query.token as string | undefined);

    if (!isDefined(authHeader)) {
      return null;
    }

    return authHeader.replace('Bearer ', '');
  }
}
