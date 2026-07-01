import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AnimalEvent, Prisma } from '@prisma/client';
import { AnimalEventsRepository } from './animal-events.repository';
import { CreateAnimalEventDto } from './dto/create-animal-event.dto';

/** Bitácora del animal. Todo se acota al establishmentId del usuario autenticado. */
@Injectable()
export class AnimalEventsService {
  constructor(private readonly repo: AnimalEventsRepository) {}

  async create(
    establishmentId: string,
    animalId: string,
    dto: CreateAnimalEventDto,
  ): Promise<AnimalEvent> {
    // Idempotencia para el sync offline.
    if (dto.id) {
      const existing = await this.repo.findById(dto.id);
      if (existing) return this.ownedOrConflict(existing, establishmentId);
    }

    const animalOk = await this.repo.animalBelongsToEstablishment(animalId, establishmentId);
    if (!animalOk) throw new NotFoundException(`Animal ${animalId} not found`);

    const data: Prisma.AnimalEventCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      type: dto.type,
      note: dto.note ?? null,
      score: dto.score !== undefined ? new Prisma.Decimal(dto.score) : null,
      weightKg: dto.weightKg !== undefined ? new Prisma.Decimal(dto.weightKg) : null,
      data: (dto.data ?? {}) as Prisma.InputJsonValue,
      ...(dto.date ? { date: new Date(dto.date) } : {}),
      animal: { connect: { id: animalId } },
      establishment: { connect: { id: establishmentId } },
    };

    try {
      return await this.repo.create(data);
    } catch (err) {
      if (dto.id && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.repo.findById(dto.id);
        if (existing) return this.ownedOrConflict(existing, establishmentId);
      }
      throw err;
    }
  }

  async listByAnimal(establishmentId: string, animalId: string): Promise<AnimalEvent[]> {
    const animalOk = await this.repo.animalBelongsToEstablishment(animalId, establishmentId);
    if (!animalOk) throw new NotFoundException(`Animal ${animalId} not found`);
    return this.repo.byAnimal(establishmentId, animalId);
  }

  private ownedOrConflict(event: AnimalEvent, establishmentId: string): AnimalEvent {
    if (event.establishmentId !== establishmentId) {
      throw new ConflictException(`AnimalEvent ${event.id} already exists`);
    }
    return event;
  }
}
