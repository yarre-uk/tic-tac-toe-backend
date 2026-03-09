import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { isDefined } from '../utils';
import { JwtService } from '@nestjs/jwt';
import { UserPayload } from '@/auth/auth.service';
import { Reflector } from '@nestjs/core';

export const IsPublic = Reflector.createDecorator<boolean>();

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
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

    try {
      const payload = this.jwtService.verify<UserPayload>(accessToken);
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Provided token is invalid!');
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    return request.headers.authorization?.replace('Bearer ', '') ?? null;
  }
}
