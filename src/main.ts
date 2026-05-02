import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import compression from 'compression';

const PORT = process.env.PORT ?? 3000;
const SWAGGER_ROUTE = 'api';

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
  SwaggerModule.setup(SWAGGER_ROUTE, app, documentFactory);

  await app.listen(PORT);

  console.log(`Backend is running on: http://localhost:${PORT}`);
  console.log(
    `Swagger is running on: http://localhost:${PORT}/${SWAGGER_ROUTE}`,
  );
  console.log(`WebSocket gateway available at: ws://localhost:${PORT}/ws`);
}

void bootstrap();
