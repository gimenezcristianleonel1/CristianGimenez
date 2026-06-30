import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@shared/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('apiPrefix', 'api/v1');
  const port = config.get<number>('port', 3000);

  app.setGlobalPrefix(apiPrefix);

  // Strict, whitelisted input validation for every endpoint.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Centralised error handling.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger / OpenAPI documentation.
  if (config.get<boolean>('swagger.enabled', true)) {
    const swaggerPath = config.get<string>('swagger.path', 'docs');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Livestock Management API')
      .setDescription(
        'Sistema de Gestión Ganadera: trazabilidad animal, sanidad, ' +
          'movimientos de potrero y bases de IA predictiva.',
      )
      .setVersion('0.1.0')
      .addTag('Health')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/${swaggerPath}`, app, document);
  }

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🐄 Livestock Management API running on http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
