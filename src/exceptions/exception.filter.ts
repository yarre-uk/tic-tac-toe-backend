/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';

import { Prisma } from '@/generated/prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // handle known HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message;

      // only log 5xx as errors, 4xx as warnings
      if (status >= 500) {
        this.logger.error({ message, path: request.url, status });
      } else {
        this.logger.log({ message, path: request.url, status });
      }

      return response.status(status).json({
        success: false,
        error: {
          message: Array.isArray(message) ? message : [message],
          code: this.getErrorCode(exception),
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }

    // handle prisma errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception, request, response);
    }

    // handle completely unknown errors — never leak internals
    this.logger.error({
      message: 'Unexpected error',
      error: exception instanceof Error ? exception.stack : exception,
      path: request.url,
    });

    return response.status(500).json({
      success: false,
      error: {
        message: ['Internal server error'],
        code: 'INTERNAL_ERROR',
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private handlePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
    request: Request,
    response: Response,
  ) {
    const prismaErrorMap: Record<string, { status: number; message: string }> =
      {
        P2002: {
          status: 409,
          message: `Constraint on ${this.getPrismaP2002Field(exception)} failed`,
        },
        P2025: { status: 404, message: 'Resource not found' },
        P2003: { status: 400, message: 'Foreign key constraint failed' },
      };

    const mapped = prismaErrorMap[exception.code] ?? {
      status: 500,
      message: 'Database error',
    };

    return response.status(mapped.status).json({
      success: false,
      error: {
        message: [mapped.message],
        code: exception.code,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getPrismaP2002Field(
    exception: Prisma.PrismaClientKnownRequestError,
  ): string {
    // standard Prisma client
    if (exception.meta?.target) {
      return (exception.meta.target as string[])?.[0] ?? 'Resource';
    }

    // PrismaPg adapter — field is in the constraint name
    const originalMessage = (exception.meta?.driverAdapterError as any)?.cause
      ?.originalMessage as string | undefined;

    if (originalMessage) {
      // extracts "nickname" from 'duplicate key value violates unique constraint "User_nickname_key"'
      const match = originalMessage.match(/"([^"]+)"/)?.[1];
      const field = match?.split('_')[1]; // "User_nickname_key" → "nickname"
      return field ?? 'Resource';
    }

    return 'Resource';
  }

  private getErrorCode(exception: HttpException): string {
    if (exception instanceof NotFoundException) return 'NOT_FOUND';
    if (exception instanceof UnauthorizedException) return 'UNAUTHORIZED';
    if (exception instanceof ForbiddenException) return 'FORBIDDEN';
    if (exception instanceof ConflictException) return 'CONFLICT';
    if (exception instanceof BadRequestException) return 'BAD_REQUEST';
    return 'INTERNAL_ERROR';
  }
}
