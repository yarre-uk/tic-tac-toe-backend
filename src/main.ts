import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

const PORT = process.env.PORT ?? 3000;
const SWAGGER_ROUTE = 'api';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcElem: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'", 'data:'],
        },
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Tic Tac Toe API')
    .setDescription('Backend API for the tic-tac-toe application')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

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
}

void bootstrap();
