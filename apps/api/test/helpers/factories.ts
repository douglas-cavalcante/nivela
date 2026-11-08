import { hash } from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';

export const DEFAULT_PASSWORD = 'segredo123';

let sequence = 0;

interface UserOverrides {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  active?: boolean;
}

/** Cria um usuário direto no banco (custo baixo do bcrypt para acelerar os testes). */
export async function createUser(
  prisma: PrismaService,
  overrides: UserOverrides = {},
) {
  sequence += 1;
  const role = overrides.role ?? Role.Student;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `Usuário ${sequence}`,
      email: overrides.email ?? `usuario${sequence}@nivela.test`,
      password: await hash(overrides.password ?? DEFAULT_PASSWORD, 4),
      role,
      active: overrides.active ?? true,
    },
  });
  if (role === Role.Student) {
    await prisma.studentProfile.create({ data: { userId: user.id } });
  }
  return user;
}

interface ClassroomOverrides {
  teacherId?: number;
  name?: string;
  joinCode?: string;
  active?: boolean;
}

/** Cria uma turma (e um professor, se não for informado). */
export async function createClassroom(
  prisma: PrismaService,
  overrides: ClassroomOverrides = {},
) {
  sequence += 1;
  const teacherId =
    overrides.teacherId ??
    (await createUser(prisma, { role: Role.Teacher })).id;
  return prisma.classroom.create({
    data: {
      teacherId,
      name: overrides.name ?? `Turma ${sequence}`,
      schoolYear: '9º ano',
      joinCode:
        overrides.joinCode ?? `NIV-T${String(sequence).padStart(3, '0')}`,
      active: overrides.active ?? true,
    },
  });
}
