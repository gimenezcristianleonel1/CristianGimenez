import { ConflictException, NotFoundException } from '@nestjs/common';
import { Task, TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';

const EST = 'est-1';
const HOUR = 60 * 60 * 1000;

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Tarea',
    description: null,
    status: TaskStatus.PENDING,
    dueDate: null,
    completedAt: null,
    establishmentId: EST,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TasksService', () => {
  let service: TasksService;
  let repo: { create: jest.Mock; findById: jest.Mock; findAllByEstablishment: jest.Mock; update: jest.Mock };

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAllByEstablishment: jest.fn(),
      update: jest.fn((_id, data) => Promise.resolve({ ...buildTask(), ...data })),
    };
    service = new TasksService(repo as unknown as TasksRepository);
  });

  describe('findAll (notificación)', () => {
    it('marca como urgentes las pendientes vencidas o dentro de 48h', async () => {
      const overdue = buildTask({ id: 'a', dueDate: new Date(Date.now() - 24 * HOUR) });
      const soon = buildTask({ id: 'b', dueDate: new Date(Date.now() + 24 * HOUR) });
      const later = buildTask({ id: 'c', dueDate: new Date(Date.now() + 72 * HOUR) });
      const done = buildTask({ id: 'd', status: TaskStatus.COMPLETED, dueDate: new Date(Date.now() - HOUR) });
      const noDate = buildTask({ id: 'e' });
      repo.findAllByEstablishment.mockResolvedValue([overdue, soon, later, done, noDate]);

      const res = await service.findAll(EST);

      expect(res.success).toBe(true);
      expect(res.notification).not.toBeNull();
      expect(res.notification!.type).toBe('WARNING');
      expect(res.notification!.urgentTaskIds.sort()).toEqual(['a', 'b']);
      expect(res.notification!.message).toContain('2');
      expect(res.tasks).toHaveLength(5);
    });

    it('devuelve notification null cuando no hay tareas urgentes', async () => {
      repo.findAllByEstablishment.mockResolvedValue([
        buildTask({ dueDate: new Date(Date.now() + 10 * 24 * HOUR) }),
      ]);
      const res = await service.findAll(EST);
      expect(res.notification).toBeNull();
    });
  });

  describe('create (idempotente para sync)', () => {
    it('devuelve la tarea existente sin duplicar cuando el id del cliente ya existe', async () => {
      const existing = buildTask({ id: 'dup', title: 'Ya creada' });
      repo.findById.mockResolvedValue(existing);
      const res = await service.create(EST, { id: 'dup', title: 'Ya creada' });
      expect(res).toBe(existing);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('crea normalmente cuando el id no existe', async () => {
      repo.findById.mockResolvedValue(null);
      repo.create.mockResolvedValue(buildTask({ id: 'new' }));
      await service.create(EST, { id: 'new', title: 'Nueva' });
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('una colisión de id con otro establecimiento es un conflicto (no 500)', async () => {
      repo.findById.mockResolvedValue(buildTask({ id: 'dup', establishmentId: 'otro' }));
      await expect(service.create(EST, { id: 'dup', title: 'X' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('registra completedAt al pasar a COMPLETED', async () => {
      repo.findById.mockResolvedValue(buildTask({ status: TaskStatus.PENDING }));
      await service.update(EST, 'task-1', { status: TaskStatus.COMPLETED });
      const data = repo.update.mock.calls[0][1];
      expect(data.status).toBe(TaskStatus.COMPLETED);
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('limpia completedAt al volver a PENDING', async () => {
      repo.findById.mockResolvedValue(buildTask({ status: TaskStatus.COMPLETED, completedAt: new Date() }));
      await service.update(EST, 'task-1', { status: TaskStatus.PENDING });
      expect(repo.update.mock.calls[0][1].completedAt).toBeNull();
    });

    it('rechaza actualizar una tarea de otro establecimiento (404)', async () => {
      repo.findById.mockResolvedValue(buildTask({ establishmentId: 'otro' }));
      await expect(service.update(EST, 'task-1', { title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
