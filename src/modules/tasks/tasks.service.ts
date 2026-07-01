import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    // Idempotencia para el sync offline: si ya existe una tarea con el id del
    // cliente, la devolvemos tal cual. Así un reintento (la red se cortó después
    // de que el server guardó) no falla ni duplica, y la cola no se traba.
    if (dto.id) {
      const existing = await this.repo.findById(dto.id);
      if (existing) return this.ownedOrConflict(existing, establishmentId);
    }

    const data: Prisma.TaskCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      establishment: { connect: { id: establishmentId } },
    };

    try {
      return await this.repo.create(data);
    } catch (err) {
      // Carrera entre dos reintentos casi simultáneos: si chocó la PK, devolvemos
      // la tarea ya creada en vez de un 500.
      if (dto.id && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.repo.findById(dto.id);
        if (existing) return this.ownedOrConflict(existing, establishmentId);
      }
      throw err;
    }
  }

  /** Devuelve la tarea si es del establecimiento; si no, es una colisión de id ajena. */
  private ownedOrConflict(task: Task, establishmentId: string): Task {
    if (task.establishmentId !== establishmentId) {
      throw new ConflictException(`Task ${task.id} already exists`);
    }
    return task;
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
