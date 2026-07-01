import { Injectable } from '@nestjs/common';
import { ImportTemplate, Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/database/prisma.service';

/** Acceso a las plantillas de mapeo, siempre acotado por establecimiento. */
@Injectable()
export class ImportTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySignature(establishmentId: string, signature: string): Promise<ImportTemplate | null> {
    return this.prisma.importTemplate.findUnique({
      where: { establishmentId_signature: { establishmentId, signature } },
    });
  }

  /** Crea o actualiza la plantilla para esa firma dentro del establecimiento. */
  upsert(
    establishmentId: string,
    signature: string,
    mapping: Prisma.InputJsonValue,
    name?: string,
  ): Promise<ImportTemplate> {
    return this.prisma.importTemplate.upsert({
      where: { establishmentId_signature: { establishmentId, signature } },
      update: { mapping, ...(name ? { name } : {}) },
      create: { establishmentId, signature, mapping, name: name ?? null },
    });
  }
}
