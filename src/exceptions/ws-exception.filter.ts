/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('WsExceptionFilter');

  override catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    const { message, status } = this.extractInfo(exception);

    // Mirror the HTTP filter's convention:
    // 4xx (expected client errors) → log, 5xx / unknown → error.
    if (typeof status === 'number' && status >= 500) {
      this.logger.error({ message, socketId: client.id, status });
    } else {
      this.logger.log({ message, socketId: client.id, status });
    }

    // Delegate to the base filter which emits the `exception` event to the client.
    super.catch(exception, host);
  }

  private extractInfo(exception: unknown): {
    message: string;
    status: number | string;
  } {
    if (exception instanceof WsException) {
      const error = exception.getError();
      const message = typeof error === 'string' ? error : JSON.stringify(error);
      // WsExceptions don't carry an HTTP status — use 'ws' as a sentinel.
      return { message, status: 'ws' };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as any).message ?? 'Http error');
      return { message, status: exception.getStatus() };
    }

    if (exception instanceof Error) {
      return { message: exception.message, status: 500 };
    }

    return { message: 'Unknown error', status: 500 };
  }
}
