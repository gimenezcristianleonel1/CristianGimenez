import { Injectable } from '@nestjs/common';
import { PushSubscription, Task, TaskStatus } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Alta/actualización de una suscripción (idempotente por endpoint). */
  upsertSubscription(data: {
    endpoint: string;
    p256dh: string;
    auth: string;
    establishmentId: string;
  }): Promise<PushSubscription> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { p256dh: data.p256dh, auth: data.auth, establishmentId: data.establishmentId },
      create: data,
    });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  findSubscriptionsByEstablishment(establishmentId: string): Promise<PushSubscription[]> {
    return this.prisma.pushSubscription.findMany({ where: { establishmentId } });
  }

  /** Tareas pendientes con fecha límite (candidatas a aviso). Job de sistema. */
  findPendingWithDueDate(): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { status: TaskStatus.PENDING, dueDate: { not: null } },
    });
  }

  markMilestones(taskId: string, milestones: string[]): Promise<Task> {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { notifiedMilestones: milestones },
    });
  }
}
