import { NotFoundException } from '@nestjs/common';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { ClassroomsService } from 'src/modules/classrooms/classrooms.service';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const user = (role: Role, id = 5): AuthUser => ({
  id,
  role,
  name: 'Fulano',
  email: 'fulano@escola.test',
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: '9º A',
  schoolYear: null,
  joinCode: 'NIV-4K7Q',
  active: true,
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  teacher: { id: 5, name: 'Ana' },
  _count: { students: 2 },
  students: [],
  ...overrides,
});

describe('classroomScope', () => {
  it('administrador vê tudo; professor, só as próprias; outros perfis, nada', () => {
    expect(classroomScope(user(Role.Admin))).toEqual({});
    expect(classroomScope(user(Role.Teacher, 8))).toEqual({ teacherId: 8 });
    expect(classroomScope(user(Role.Student))).toEqual({ id: { in: [] } });
  });
});

describe('ClassroomsService', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const count = jest.fn();
  const update = jest.fn();
  const userFindFirst = jest.fn();
  const createWithUniqueCode = jest.fn();
  const regenerate = jest.fn();
  const service = new ClassroomsService(
    {
      classroom: { findMany, findFirst, findUnique, count, update },
      user: { findFirst: userFindFirst },
    } as unknown as PrismaService,
    { createWithUniqueCode, regenerate } as unknown as JoinCodeService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('list', () => {
    it('parte sempre do escopo do usuário e junta busca e situação', async () => {
      findMany.mockResolvedValue([row()]);
      count.mockResolvedValue(1);

      const result = await service.list(
        { page: 1, per_page: 15, search: '9%', status: 'inactive' },
        user(Role.Teacher, 5),
      );

      const where = {
        AND: [
          { teacherId: 5 },
          { active: false, name: { contains: '9\\%', mode: 'insensitive' } },
        ],
      };
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where, skip: 0, take: 15 }),
      );
      expect(count).toHaveBeenCalledWith({ where });
      expect(result.data[0]).toMatchObject({
        id: 1,
        join_code: 'NIV-4K7Q',
        students_count: 2,
        teacher: { id: 5, name: 'Ana' },
      });
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('procura pelo id dentro do escopo e responde 404 se não achar', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.findOne(9, user(Role.Teacher, 5))).rejects.toThrow(
        new NotFoundException('Turma não encontrada.'),
      );
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ id: 9 }, { teacherId: 5 }] },
        }),
      );
    });
  });

  describe('create', () => {
    it('professor cria para si mesmo, ignorando teacher_id', async () => {
      createWithUniqueCode.mockResolvedValue({ id: 1 });
      findFirst.mockResolvedValue(row());

      await service.create(
        { name: '9º A', teacher_id: 99 },
        user(Role.Teacher, 5),
      );

      expect(createWithUniqueCode).toHaveBeenCalledWith({
        teacherId: 5,
        name: '9º A',
        schoolYear: null,
      });
      expect(userFindFirst).not.toHaveBeenCalled();
    });

    it('admin precisa informar um professor existente', async () => {
      const missing = await service
        .create({ name: '9º A' }, user(Role.Admin))
        .catch((e: unknown) => e);
      expect(missing).toBeInstanceOf(FieldValidationException);
      expect((missing as FieldValidationException).getResponse()).toMatchObject(
        { errors: { teacher_id: ['Informe o professor da turma.'] } },
      );

      userFindFirst.mockResolvedValue(null);
      const unknown = await service
        .create({ name: '9º A', teacher_id: 7 }, user(Role.Admin))
        .catch((e: unknown) => e);
      expect((unknown as FieldValidationException).getResponse()).toMatchObject(
        { errors: { teacher_id: ['Professor não encontrado.'] } },
      );
      expect(userFindFirst).toHaveBeenCalledWith({
        where: { id: 7, role: Role.Teacher },
        select: { id: true },
      });
      expect(createWithUniqueCode).not.toHaveBeenCalled();
    });
  });

  describe('update e regenerateJoinCode', () => {
    it('não alteram nada quando a turma está fora do escopo', async () => {
      findFirst.mockResolvedValue(null);
      const teacher = user(Role.Teacher, 6);

      await expect(
        service.update(1, { name: 'Outra' }, teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.regenerateJoinCode(1, teacher),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(update).not.toHaveBeenCalled();
      expect(regenerate).not.toHaveBeenCalled();
    });

    it('regenera o código de uma turma visível', async () => {
      findFirst.mockResolvedValue({ id: 1 });
      regenerate.mockResolvedValue('NIV-NEW2');

      await expect(
        service.regenerateJoinCode(1, user(Role.Admin)),
      ).resolves.toEqual({ join_code: 'NIV-NEW2' });
    });
  });

  describe('findJoinable', () => {
    it('devolve a turma ativa', async () => {
      findUnique.mockResolvedValue({ id: 3, active: true });

      await expect(service.findJoinable('NIV-4K7Q')).resolves.toMatchObject({
        id: 3,
      });
    });

    it('usa o cliente da transação quando informado', async () => {
      const txFind = jest.fn().mockResolvedValue({ id: 3, active: true });

      await service.findJoinable('NIV-4K7Q', {
        classroom: { findUnique: txFind },
      } as never);

      expect(txFind).toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
    });

    it.each([
      [null, 'Código de turma inválido.'],
      [{ id: 3, active: false }, 'Esta turma não está aceitando novos alunos.'],
    ])('rejeita %j com a mensagem do campo', async (found, message) => {
      findUnique.mockResolvedValue(found);

      const error = await service
        .findJoinable('NIV-4K7Q')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(FieldValidationException);
      expect((error as FieldValidationException).getResponse()).toMatchObject({
        errors: { join_code: [message] },
      });
    });
  });
});
