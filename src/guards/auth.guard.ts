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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const accessToken = this.extractToken(request);

    if (!isDefined(accessToken)) {
      throw new UnauthorizedException('No token provided!');
    }

    try {
      const payload: unknown = this.jwtService.decode(accessToken);
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
