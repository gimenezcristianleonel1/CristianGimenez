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

  // CORS so the offline-first PWA (served from another origin) can call the API.
  const corsOrigin = config.get<string>('corsOrigin', '*');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

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
          'movimientos de potrero y bases de IA predictiva.\n\n' +
          '**Módulos:** Inventario Animal · Sanidad · Ubicaciones · Movimientos.\n' +
          '**Arquitectura:** Clean/Layered + EDA (Outbox) + PredictiveEngine.',
      )
      .setVersion('0.1.0')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addTag('Health', 'Liveness y conectividad de la base de datos')
      .addTag('Animals', 'Inventario animal, genealogía, pesajes y proyección de GDP')
      .addTag('Locations', 'Potreros, corrales y lotes (capacidad / ocupación)')
      .addTag('Sanidad', 'Eventos sanitarios y períodos de carencia')
      .addTag('Movements', 'Traslados de animales entre ubicaciones')
      .addTag('Import', 'Importación de Excel/fotos y exportación de animales')
      .addTag('Tasks', 'Planificación y tareas del campo con alertas de vencimiento')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/${swaggerPath}`, app, document, {
      customSiteTitle: 'Livestock Management API · Docs',
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    });
  }

  // Bind to 0.0.0.0 so PaaS platforms (Render, Railway, etc.) can route traffic.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🐄 Livestock Management API running on port ${port} (prefix /${apiPrefix})`);
}

void bootstrap();
