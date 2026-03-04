import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../services/prisma.client';
import { Reflector } from '@nestjs/core';
import { isDefined } from '../utils';

export const Roles = Reflector.createDecorator<string[]>();

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as unknown;

    if (!isDefined(user)) {
      throw new InternalServerErrorException(
        'No user property in the request object found!',
      );
    }

    const roles = this.reflector.get(Roles, context.getHandler());

    if (!isDefined(roles) || roles.length === 0) {
      return true;
    }

    //TODO check roles

    return true;
  }
}
