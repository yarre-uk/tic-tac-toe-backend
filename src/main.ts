import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const PORT = process.env.PORT ?? 3000;
const SWAGGER_ROUTE = 'api';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder().build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_ROUTE, app, documentFactory);

  await app.listen(PORT);

  console.log(`Backend is running on: http://localhost:${PORT}`);
  console.log(
    `Swagger is running on: http://localhost:${PORT}/${SWAGGER_ROUTE}`,
  );
}

void bootstrap();
