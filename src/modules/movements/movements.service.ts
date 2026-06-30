import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnimalMovement, AnimalStatus, Prisma } from '@prisma/client';
import { EVENT_PUBLISHER, IEventPublisher } from '@core/domain/events/event-publisher.interface';
import { AnimalsRepository } from '@modules/animals/animals.repository';
import { LocationsRepository } from '@modules/locations/locations.repository';
import { MovementsRepository } from './movements.repository';
import { CreateMovementDto } from './dto/create-movement.dto';
import { AnimalMovedEvent } from './events/movement.events';

/** Terminal statuses: such animals can no longer be moved. */
const NON_MOVABLE: AnimalStatus[] = [AnimalStatus.SOLD, AnimalStatus.DECEASED];

@Injectable()
export class MovementsService {
  constructor(
    private readonly repo: MovementsRepository,
    private readonly animals: AnimalsRepository,
    private readonly locations: LocationsRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: IEventPublisher,
  ) {}

  async moveAnimal(
    establishmentId: string,
    animalId: string,
    dto: CreateMovementDto,
  ): Promise<AnimalMovement> {
    const animal = await this.animals.findById(animalId);
    if (!animal || animal.establishmentId !== establishmentId) {
      throw new NotFoundException(`Animal ${animalId} not found`);
    }
    if (NON_MOVABLE.includes(animal.status)) {
      throw new ConflictException(`Animal ${animal.tagId} is ${animal.status} and cannot be moved`);
    }

    const fromLocationId = animal.currentLocationId;
    if (fromLocationId === dto.toLocationId) {
      throw new BadRequestException('The animal is already in the destination location');
    }

    const destination = await this.locations.findById(dto.toLocationId);
    if (!destination || destination.establishmentId !== establishmentId) {
      throw new BadRequestException(`Destination location ${dto.toLocationId} does not exist`);
    }
    if (destination.capacity !== null) {
      const occupancy = await this.locations.countResidents(destination.id);
      if (occupancy >= destination.capacity) {
        throw new ConflictException(
          `Destination "${destination.name}" is at full capacity (${destination.capacity})`,
        );
      }
    }

    const movedAt = dto.movedAt ? new Date(dto.movedAt) : new Date();

    const data: Prisma.AnimalMovementUncheckedCreateInput = {
      ...(dto.id ? { id: dto.id } : {}),
      animalId,
      fromLocationId,
      toLocationId: dto.toLocationId,
      reason: dto.reason ?? null,
      movedAt,
      notes: dto.notes ?? null,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    };

    const event = new AnimalMovedEvent(animalId, {
      fromLocationId,
      toLocationId: dto.toLocationId,
      reason: dto.reason ?? null,
      movedAt: movedAt.toISOString(),
    });

    const movement = await this.repo.move(data, event);
    await this.events.publish(event);
    return movement;
  }

  async findForAnimal(establishmentId: string, animalId: string): Promise<AnimalMovement[]> {
    const animal = await this.animals.findById(animalId);
    if (!animal || animal.establishmentId !== establishmentId) {
      throw new NotFoundException(`Animal ${animalId} not found`);
    }
    return this.repo.findByAnimal(animalId);
  }
}
