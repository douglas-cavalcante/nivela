// Seed do administrador inicial. Idempotente: se o e-mail já existe, não altera nada.
// Credenciais vêm de ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (ver .env.example).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from 'src/generated/prisma/client';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente ${name} é obrigatória para o seed.`);
  }
  return value;
}

async function main(): Promise<void> {
  const name = required('ADMIN_NAME');
  const email = required('ADMIN_EMAIL').toLowerCase();
  const password = required('ADMIN_PASSWORD');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      console.log(`Administrador ${email} já existe; nada a fazer.`);
      return;
    }

    await prisma.user.create({
      data: {
        name,
        email,
        password: await hash(password, 10),
        role: 'admin',
      },
    });
    console.log(`Administrador ${email} criado.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
