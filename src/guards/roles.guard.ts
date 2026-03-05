import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { isDefined } from '../utils';
import { Role } from '@/generated/prisma/enums';
import { JwtAccessTokenPayload } from '@/auth/auth.service';

const RolePriorities = {
  Admin: 3,
  Moderator: 2,
  User: 1,
} as const satisfies Record<Role, number>;

export const RequiresRole = Reflector.createDecorator<Role>();

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as JwtAccessTokenPayload;

    if (!isDefined(user)) {
      throw new InternalServerErrorException(
        'No user property in the request object found!',
      );
    }

    const minimumRole = this.reflector.get(RequiresRole, context.getHandler());

    if (!isDefined(minimumRole)) {
      return true;
    }

    const userRole = user.role;

    if (!isDefined(userRole)) {
      throw new InternalServerErrorException('No user role was found!');
    }

    if (RolePriorities[minimumRole] > RolePriorities[userRole]) {
      return false;
    }

    return true;
  }
}
