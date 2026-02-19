import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, ip, originalUrl } = req;
    const userAgent = req.get('user-agent');

    this.logger.log(
      `Request from ${ip}/${userAgent} - ${method} ${originalUrl}`,
    );

    next();
  }
}
