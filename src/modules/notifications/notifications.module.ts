import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { PushService } from './push.service';
import { NotificationsScheduler } from './notifications.scheduler';

/**
 * Avisos Web Push: guarda las suscripciones de los navegadores y un job
 * periódico envía los recordatorios de tareas aunque la app esté cerrada.
 * Consume PrismaService (global) y ConfigService. Inerte si faltan claves VAPID.
 */
@Module({
  controllers: [NotificationsController],
  providers: [PushService, NotificationsRepository, NotificationsScheduler],
})
export class NotificationsModule {}
