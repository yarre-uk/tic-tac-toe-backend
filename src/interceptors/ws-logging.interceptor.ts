import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Socket } from 'socket.io';

import { SocketData } from '@/guards';

@Injectable()
export class WsLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('WS');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const wsContext = context.switchToWs();
    const client = wsContext.getClient<Socket>();
    const event = wsContext.getPattern();
    const userId = (client.data as SocketData).user?.sub ?? 'unknown';

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${userId} ${event} - ${Date.now() - startedAt}ms`);
        },
        error: (error: Error) => {
          this.logger.error(
            `${userId} ${event} - ${Date.now() - startedAt}ms | ${error.message ?? error}`,
          );
        },
      }),
    );
  }
}
