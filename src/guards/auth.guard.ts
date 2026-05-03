import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import Redis from 'ioredis';

import { isDefined } from '../utils';

import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { UserPayload } from '@/modules/auth/auth.service';

export const IsPublic = Reflector.createDecorator<boolean>();

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride(IsPublic, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const accessToken = this.extractToken(request);

    if (!isDefined(accessToken)) {
      throw new UnauthorizedException('No token provided!');
    }

    let payload: UserPayload;

    try {
      payload = this.jwtService.verify<UserPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Provided token is invalid!');
    }

    const isBlacklisted = await this.redis.exists(`blacklist:${payload.jti}`);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked!');
    }

    request['user'] = payload;

    return true;
  }

  private extractToken(request: Request): string | null {
    return request.headers.authorization?.replace('Bearer ', '') ?? null;
  }
}
