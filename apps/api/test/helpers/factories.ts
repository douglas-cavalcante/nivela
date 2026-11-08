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

interface SubjectOverrides {
  name?: string;
  color?: string;
  icon?: string;
}

/** Cria uma disciplina direto no banco. */
export async function createSubject(
  prisma: PrismaService,
  overrides: SubjectOverrides = {},
) {
  sequence += 1;
  return prisma.subject.create({
    data: {
      name: overrides.name ?? `Disciplina ${sequence}`,
      color: overrides.color ?? 'teal',
      icon: overrides.icon ?? 'book',
    },
  });
}

interface CategoryOverrides {
  subjectId?: number;
  name?: string;
}

/** Cria uma categoria (e uma disciplina, se não for informada). */
export async function createCategory(
  prisma: PrismaService,
  overrides: CategoryOverrides = {},
) {
  sequence += 1;
  const subjectId = overrides.subjectId ?? (await createSubject(prisma)).id;
  return prisma.category.create({
    data: { subjectId, name: overrides.name ?? `Categoria ${sequence}` },
  });
}

interface QuestionOverrides {
  authorId?: number;
  subjectId?: number;
  categoryId?: number;
  statement?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
  imagePath?: string | null;
}

/** Cria uma questão com as 5 alternativas (correta: A). Cria autor, disciplina e categoria se faltarem. */
export async function createQuestion(
  prisma: PrismaService,
  overrides: QuestionOverrides = {},
) {
  sequence += 1;
  const authorId =
    overrides.authorId ?? (await createUser(prisma, { role: Role.Teacher })).id;
  let subjectId = overrides.subjectId;
  let categoryId = overrides.categoryId;
  if (categoryId === undefined) {
    const category = await createCategory(prisma, { subjectId });
    categoryId = category.id;
    subjectId = category.subjectId;
  }
  subjectId ??= (
    await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    })
  ).subjectId;
  return prisma.question.create({
    data: {
      authorId,
      subjectId,
      categoryId,
      statement: overrides.statement ?? `Enunciado da questão ${sequence}?`,
      difficulty: overrides.difficulty ?? 'medium',
      explanation: 'Explicação da resposta.',
      active: overrides.active ?? true,
      imagePath: overrides.imagePath ?? null,
      options: {
        create: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({
          letter,
          text: `Alternativa ${letter}`,
          isCorrect: letter === 'A',
        })),
      },
    },
  });
}
