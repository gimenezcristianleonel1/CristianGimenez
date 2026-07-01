import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskStatus } from '@prisma/client';
import { TasksRepository } from './tasks.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

/** Ventana para considerar una tarea "próxima a vencer": 48 horas. */
const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface TaskNotification {
  type: 'WARNING';
  message: string;
  urgentTaskIds: string[];
}

export interface TaskListResponse {
  success: true;
  notification: TaskNotification | null;
  tasks: Task[];
}

/** Todas las operaciones se acotan al establishmentId del usuario autenticado. */
@Injectable()
export class TasksService {
  constructor(private readonly repo: TasksRepository) {}

  async create(establishmentId: string, dto: CreateTaskDto): Promise<Task> {
    const data: Prisma.TaskCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      establishment: { connect: { id: establishmentId } },
    };
    return this.repo.create(data);
  }

  /**
   * Lista las tareas del establecimiento (ordenadas por dueDate asc) y calcula
   * dinámicamente las tareas pendientes próximas a vencer o vencidas.
   */
  async findAll(establishmentId: string): Promise<TaskListResponse> {
    const tasks = await this.repo.findAllByEstablishment(establishmentId);

    const threshold = new Date(Date.now() + UPCOMING_WINDOW_MS);
    const urgent = tasks.filter(
      (t) =>
        t.status === TaskStatus.PENDING &&
        t.dueDate !== null &&
        t.dueDate.getTime() <= threshold.getTime(),
    );

    const notification: TaskNotification | null =
      urgent.length > 0
        ? {
            type: 'WARNING',
            message: `Tenés ${urgent.length} tareas pendientes para los próximos días o vencidas.`,
            urgentTaskIds: urgent.map((t) => t.id),
          }
        : null;

    return { success: true, notification, tasks };
  }

  async update(establishmentId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.getOwnedOrThrow(establishmentId, id);

    const data: Prisma.TaskUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
    };

    // Al pasar a COMPLETED se registra completedAt; al volver a PENDING se limpia.
    if (dto.status !== undefined && dto.status !== task.status) {
      data.status = dto.status;
      data.completedAt = dto.status === TaskStatus.COMPLETED ? new Date() : null;
    }

    return this.repo.update(id, data);
  }

  private async getOwnedOrThrow(establishmentId: string, id: string): Promise<Task> {
    const task = await this.repo.findById(id);
    if (!task || task.establishmentId !== establishmentId) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }
}
