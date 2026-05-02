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

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
export class AuthGateway {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  @SubscribeMessage('auth:refresh')
  async handleRefresh(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { token: string },
  ) {
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

    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new WsException('Token has been revoked');
    }

    const data = client.data as SocketData;
    data.token = raw;
    data.user = payload;

    return { event: 'auth:refreshed' };
  }
}
