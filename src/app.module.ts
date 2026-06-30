import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { HealthModule } from '@modules/health/health.module';

@Module({
  imports: [
    // Typed, validated configuration available everywhere.
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // In-process event bus that backs the Event-Driven Architecture.
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),

    // Infrastructure
    PrismaModule,

    // Feature modules (Animals, Health, Locations added in later steps)
    HealthModule,
  ],
})
export class AppModule {}
