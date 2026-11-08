import { NotFoundException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { StudentsService } from 'src/modules/students/students.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { studentScope } from 'src/shared/scopes/student-scope';

const user = (role: Role, id = 5): AuthUser => ({
  id,
  role,
  name: 'Fulano',
  email: 'fulano@escola.test',
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Ana',
  email: 'ana@aluno.test',
  active: true,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  studentProfile: { coinsBalance: 12, currentStreak: 2, bestStreak: 6 },
  enrollments: [{ classroom: { id: 3, name: '9º A' } }],
  ...overrides,
});

describe('studentScope', () => {
  it('admin vê todos os alunos; professor, só os de turmas dele', () => {
    expect(studentScope(user(Role.Admin))).toEqual({ role: Role.Student });
    expect(studentScope(user(Role.Teacher, 8))).toEqual({
      role: Role.Student,
      enrollments: { some: { classroom: { teacherId: 8 } } },
    });
  });

  it('filtro por turma entra na mesma matrícula do escopo', () => {
    expect(studentScope(user(Role.Teacher, 8), 4)).toEqual({
      role: Role.Student,
      enrollments: { some: { classroomId: 4, classroom: { teacherId: 8 } } },
    });
    expect(studentScope(user(Role.Admin), 4)).toEqual({
      role: Role.Student,
      enrollments: { some: { classroomId: 4, classroom: {} } },
    });
  });
});

describe('StudentsService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const count = jest.fn();
  const service = new StudentsService({
    user: { findMany, findFirst, count },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('lista dentro do escopo, com busca por nome ou e-mail e filtro de turma', async () => {
    findMany.mockResolvedValue([row()]);
    count.mockResolvedValue(1);

    const result = await service.list(
      { page: 2, per_page: 5, search: 'a_', classroom_id: 3 },
      user(Role.Teacher, 5),
    );

    const where = {
      AND: [
        studentScope(user(Role.Teacher, 5), 3),
        {
          OR: [
            { name: { contains: 'a\\_', mode: 'insensitive' } },
            { email: { contains: 'a\\_', mode: 'insensitive' } },
          ],
        },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 5, take: 5 }),
    );
    expect(count).toHaveBeenCalledWith({ where });
    expect(result.data).toEqual([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@aluno.test',
        active: true,
        classrooms: [{ id: 3, name: '9º A' }],
        coins_balance: 12,
        created_at: '2026-01-02T03:04:05.000Z',
      },
    ]);
    expect(result.meta).toEqual({
      page: 2,
      per_page: 5,
      total: 1,
      last_page: 1,
    });
  });

  it('as matrículas devolvidas também passam pelo escopo de turmas', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await service.list({ page: 1, per_page: 15 }, user(Role.Teacher, 5));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: { classroom: { teacherId: 5 } },
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('ficha traz sequências e usa zero se não houver perfil', async () => {
    findFirst.mockResolvedValueOnce(row());
    findFirst.mockResolvedValueOnce(row({ studentProfile: null }));

    await expect(service.findOne(1, user(Role.Admin))).resolves.toMatchObject({
      current_streak: 2,
      best_streak: 6,
    });
    await expect(service.findOne(1, user(Role.Admin))).resolves.toMatchObject({
      coins_balance: 0,
      current_streak: 0,
      best_streak: 0,
    });
  });

  it('aluno fora do escopo → 404 "Aluno não encontrado."', async () => {
    findFirst.mockResolvedValue(null);

    await expect(service.findOne(9, user(Role.Teacher, 5))).rejects.toThrow(
      new NotFoundException('Aluno não encontrado.'),
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ id: 9 }, studentScope(user(Role.Teacher, 5))] },
      }),
    );
  });
});

describe('StudentsService.createAccount', () => {
  const service = new StudentsService({} as PrismaService);
  const created = { id: 42, name: 'Ana', email: 'ana@aluno.test' };

  function fakeTx() {
    return {
      user: { create: jest.fn().mockResolvedValue(created) },
      studentProfile: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  it('cria o usuário com perfil de aluno e o student_profile na mesma transação', async () => {
    const tx = fakeTx();

    const user = await service.createAccount(tx as never, {
      name: '  Ana  ',
      email: 'ana@aluno.test',
      passwordHash: 'hash-pronto',
    });

    expect(user).toBe(created);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Ana',
        email: 'ana@aluno.test',
        password: 'hash-pronto',
        role: Role.Student,
      },
    });
    expect(tx.studentProfile.create).toHaveBeenCalledWith({
      data: { userId: 42 },
    });
  });

  it('com a senha em texto, grava só o hash bcrypt', async () => {
    const tx = fakeTx();

    await service.createAccount(tx as never, {
      name: 'Ana',
      email: 'ana@aluno.test',
      password: 'segredo123',
    });

    const { data } = tx.user.create.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(data.password).not.toBe('segredo123');
    expect(await compare('segredo123', data.password)).toBe(true);
  });
});
