import { Injectable } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

@Injectable()
export class LocationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.LocationCreateInput): Promise<Location> {
    return this.prisma.location.create({ data });
  }

  findById(id: string): Promise<Location | null> {
    return this.prisma.location.findUnique({ where: { id } });
  }

  findByName(establishmentId: string, name: string): Promise<Location | null> {
    return this.prisma.location.findUnique({
      where: { establishmentId_name: { establishmentId, name } },
    });
  }

  async findMany(
    where: Prisma.LocationWhereInput,
    skip: number,
    take: number,
  ): Promise<{ items: Location[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.location.count({ where }),
    ]);
    return { items, total };
  }

  update(id: string, data: Prisma.LocationUpdateInput): Promise<Location> {
    return this.prisma.location.update({ where: { id }, data });
  }

  delete(id: string): Promise<Location> {
    return this.prisma.location.delete({ where: { id } });
  }

  countResidents(locationId: string): Promise<number> {
    return this.prisma.animal.count({ where: { currentLocationId: locationId } });
  }
}
