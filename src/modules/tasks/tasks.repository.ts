import { Injectable } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a datos de tareas, siempre acotado por establecimiento (multi-tenant). */
@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TaskCreateInput): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  findById(id: string): Promise<Task | null> {
    return this.prisma.task.findUnique({ where: { id } });
  }

  /** Todas las tareas del establecimiento, ordenadas por dueDate ascendente. */
  findAllByEstablishment(establishmentId: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { establishmentId },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    });
  }

  update(id: string, data: Prisma.TaskUpdateInput): Promise<Task> {
    return this.prisma.task.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.delete({ where: { id } });
  }
}
