import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from '@infrastructure/config/configuration';
import { envValidationSchema } from '@infrastructure/config/env.validation';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { EventsModule } from '@infrastructure/events/events.module';
import { AiModule } from '@modules/ai/ai.module';
import { AnimalsModule } from '@modules/animals/animals.module';
import { AnimalEventsModule } from '@modules/animal-events/animal-events.module';
import { AuthModule } from '@modules/auth/auth.module';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { HealthModule } from '@modules/health/health.module';
import { ImportModule } from '@modules/import/import.module';
import { LocationsModule } from '@modules/locations/locations.module';
import { MovementsModule } from '@modules/movements/movements.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { ReproductiveModule } from '@modules/reproductive/reproductive.module';
import { SanitaryModule } from '@modules/sanitary/sanitary.module';
import { TasksModule } from '@modules/tasks/tasks.module';

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

    // Tareas programadas (job de avisos Web Push).
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,
    EventsModule,
    AiModule,

    // Feature modules
    AuthModule,
    HealthModule,
    // ImportModule antes que AnimalsModule para que sus rutas estáticas
    // (import, export/xlsx) se registren antes que animals/:id.
    ImportModule,
    AnimalsModule,
    AnimalEventsModule,
    LocationsModule,
    SanitaryModule,
    MovementsModule,
    TasksModule,
    NotificationsModule,
    ReportsModule,
    ReproductiveModule,
  ],
  providers: [
    // Authentication is required by default; routes opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
