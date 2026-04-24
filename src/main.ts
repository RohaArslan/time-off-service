import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe with strict options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,               // Strip properties not in DTO
      forbidNonWhitelisted: true,   // Throw error on extra properties
      transform: true,              // Auto-transform payloads to DTO instances
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Time-Off Microservice')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Time-Off Microservice running on port ${port}`);
}

bootstrap();