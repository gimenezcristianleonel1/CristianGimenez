import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';
import { LocationsRepository } from './locations.repository';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryLocationsDto } from './dto/query-locations.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly repo: LocationsRepository) {}

  async create(dto: CreateLocationDto): Promise<Location> {
    if (await this.repo.findByName(dto.name)) {
      throw new ConflictException(`A location named "${dto.name}" already exists`);
    }
    const data: Prisma.LocationCreateInput = {
      name: dto.name,
      type: dto.type,
      capacity: dto.capacity ?? null,
      areaHectares: dto.areaHectares !== undefined ? new Prisma.Decimal(dto.areaHectares) : null,
      description: dto.description ?? null,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    };
    return this.repo.create(data);
  }

  async findAll(query: QueryLocationsDto): Promise<{
    data: Array<Location & { occupancy?: number }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const where: Prisma.LocationWhereInput = query.type ? { type: query.type } : {};
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.repo.findMany(where, skip, query.limit);
    return {
      data: items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async findOne(id: string): Promise<Location & { occupancy: number }> {
    const location = await this.getExistingOrThrow(id);
    const occupancy = await this.repo.countResidents(id);
    return { ...location, occupancy };
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.getExistingOrThrow(id);

    if (dto.name && dto.name !== location.name) {
      const existing = await this.repo.findByName(dto.name);
      if (existing) {
        throw new ConflictException(`A location named "${dto.name}" already exists`);
      }
    }

    // Capacity cannot be set below the current number of residents.
    if (dto.capacity !== undefined) {
      const residents = await this.repo.countResidents(id);
      if (dto.capacity < residents) {
        throw new ConflictException(
          `Capacity (${dto.capacity}) cannot be lower than current occupancy (${residents})`,
        );
      }
    }

    const data: Prisma.LocationUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.areaHectares !== undefined
        ? { areaHectares: new Prisma.Decimal(dto.areaHectares) }
        : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.metadata !== undefined
        ? {
            metadata: {
              ...(location.metadata as Record<string, unknown>),
              ...dto.metadata,
            } as Prisma.InputJsonValue,
          }
        : {}),
    };
    return this.repo.update(id, data);
  }

  async remove(id: string): Promise<void> {
    await this.getExistingOrThrow(id);
    const residents = await this.repo.countResidents(id);
    if (residents > 0) {
      throw new ConflictException(
        `Cannot delete location with ${residents} animal(s) still assigned to it`,
      );
    }
    await this.repo.delete(id);
  }

  private async getExistingOrThrow(id: string): Promise<Location> {
    const location = await this.repo.findById(id);
    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }
    return location;
  }
}
