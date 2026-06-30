import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { EventsModule } from '@infrastructure/events/events.module';
import { AiModule } from '@modules/ai/ai.module';
import { AnimalsModule } from '@modules/animals/animals.module';
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
    EventsModule,
    AiModule,

    // Feature modules (Sanidad y Ubicaciones se añaden en el Paso 4)
    HealthModule,
    AnimalsModule,
  ],
})
export class AppModule {}
