import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

const PORT = process.env.PORT ?? 3000;
const APP_PREFIX = 'api/v1';
const SWAGGER_ROUTE = `docs`;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  // Tell NestJS to use Socket.IO instead of the default ws adapter.
  // Without this, @WebSocketGateway decorators are silently ignored.
  app.useWebSocketAdapter(new IoAdapter(app));

  const helmetMiddleware = helmet();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith(`/${SWAGGER_ROUTE}`)) {
      return next();
    }

    helmetMiddleware(req, res, next);
  });

  const config = new DocumentBuilder()
    .setTitle('Tic Tac Toe API')
    .setDescription('Backend API for the tic-tac-toe application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${APP_PREFIX}/${SWAGGER_ROUTE}`, app, documentFactory);

  app.setGlobalPrefix(APP_PREFIX);

  await app.listen(PORT);

  console.log(`Backend is running on: http://localhost:${PORT}/${APP_PREFIX}`);
  console.log(
    `Swagger is running on: http://localhost:${PORT}/${APP_PREFIX}/${SWAGGER_ROUTE}`,
  );
  console.log(`WebSocket gateway available at: ws://localhost:${PORT}/ws`);
}

void bootstrap();
