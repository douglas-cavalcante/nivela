import { INestApplication } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { createTestApp } from './helpers/create-test-app';
import { createUser } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

describe('containsInsensitive (banco real)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    await createUser(prisma, { name: 'joao_silva' });
    await createUser(prisma, { name: 'joaoxsilva' });
    await createUser(prisma, { name: 'a\\b 50%' });
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  const find = async (term: string) =>
    (
      await prisma.user.findMany({
        where: { name: containsInsensitive(term) },
        orderBy: { name: 'asc' },
      })
    ).map((u) => u.name);

  it('trata _, % e \\ como literais', async () => {
    expect(await find('JOAO_')).toEqual(['joao_silva']);
    expect(await find('%')).toEqual(['a\\b 50%']);
    expect(await find('x%')).toEqual([]);
    expect(await find('\\')).toEqual(['a\\b 50%']);
    expect(await find('SILVA')).toEqual(['joao_silva', 'joaoxsilva']);
  });
});
