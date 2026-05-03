import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

export interface Response<T> {
  data: T;
}

@Injectable()
export class LoggingInterceptor<T> implements NestInterceptor<T, Response<T>> {
  private logger = new Logger('HTTP');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const { ip, method, url } = request;

    const startedAt = Date.now();

    return next.handle().pipe<Response<T>>(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;
          this.logger.log(`${ip} ${method} ${url} - ${duration}ms`);
        },
        error: (error: Error) => {
          const duration = Date.now() - startedAt;
          this.logger.error(
            `${ip} ${method} ${url} - ${duration}ms | ${error.message ?? error}`,
          );
        },
      }),
    );
  }
}
