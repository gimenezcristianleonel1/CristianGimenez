/**
 * Development seed script.
 * Creates a demo user + establishment, then a few locations and animals
 * (with weight history) scoped to that establishment. Idempotent.
 *
 * Run with: npm run prisma:seed
 */
import {
  PrismaClient,
  Species,
  Sex,
  AnimalStatus,
  LocationType,
  WeightSource,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // --- Demo user + establishment (tenant) ---
  const user = await prisma.user.upsert({
    where: { googleId: 'demo-seed-user' },
    update: {},
    create: { googleId: 'demo-seed-user', email: 'demo@ganaderia.local', name: 'Productor Demo' },
  });

  let establishment = await prisma.establishment.findFirst({ where: { ownerId: user.id } });
  if (!establishment) {
    establishment = await prisma.establishment.create({
      data: { name: 'Estancia Demo', country: 'Argentina', ownerId: user.id },
    });
  }
  const establishmentId = establishment.id;

  // --- Locations (potreros / corrales) ---
  const potreroNorte = await prisma.location.upsert({
    where: { establishmentId_name: { establishmentId, name: 'Potrero Norte' } },
    update: {},
    create: {
      establishmentId,
      name: 'Potrero Norte',
      type: LocationType.PASTURE,
      capacity: 50,
      areaHectares: 12.5,
    },
  });

  await prisma.location.upsert({
    where: { establishmentId_name: { establishmentId, name: 'Corral Sanitario' } },
    update: {},
    create: {
      establishmentId,
      name: 'Corral Sanitario',
      type: LocationType.QUARANTINE_AREA,
      capacity: 10,
    },
  });

  // --- Animals with weight history ---
  const animals = [
    { tagId: 'AR-0001', breed: 'Angus', sex: Sex.MALE, birth: '2024-01-15', initial: 45.5 },
    { tagId: 'AR-0002', breed: 'Hereford', sex: Sex.FEMALE, birth: '2023-11-02', initial: 42.0 },
  ];

  for (const a of animals) {
    const animal = await prisma.animal.upsert({
      where: { establishmentId_tagId: { establishmentId, tagId: a.tagId } },
      update: {},
      create: {
        establishmentId,
        tagId: a.tagId,
        species: Species.BOVINE,
        breed: a.breed,
        sex: a.sex,
        birthDate: new Date(a.birth),
        initialWeightKg: a.initial,
        status: AnimalStatus.ACTIVE,
        currentLocationId: potreroNorte.id,
        weightHistory: {
          create: [
            { weightKg: a.initial, measuredAt: new Date(a.birth), source: WeightSource.MANUAL },
            { weightKg: a.initial + 60, measuredAt: new Date(), source: WeightSource.SCALE },
          ],
        },
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Seeded animal ${animal.tagId} (${animal.id})`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
