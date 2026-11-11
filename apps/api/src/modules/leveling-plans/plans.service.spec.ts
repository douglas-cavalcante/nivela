import { NotFoundException } from '@nestjs/common';
import { PlansService } from 'src/modules/leveling-plans/plans.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import type { Clock } from 'src/shared/clock/clock';
import { Role } from 'src/shared/enums/role.enum';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { planScope } from 'src/shared/scopes/plan-scope';

const user = (role: Role, id = 5): AuthUser => ({
  id,
  role,
  name: 'Fulano',
  email: 'fulano@escola.test',
});

describe('planScope', () => {
  it('administrador vê tudo; professor, só os próprios; outros perfis, nada', () => {
    expect(planScope(user(Role.Admin))).toEqual({});
    expect(planScope(user(Role.Teacher, 8))).toEqual({ teacherId: 8 });
    expect(planScope(user(Role.Student))).toEqual({ id: { in: [] } });
  });
});

describe('PlansService', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const clock: Clock = { now: () => now };
  const deleteMany = jest.fn();
  const findFirst = jest.fn();
  const updateMany = jest.fn();
  const chapterFindMany = jest.fn();
  const planUpdate = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const tx = {
    levelingPlan: {
      updateMany,
      findUniqueOrThrow,
      update: planUpdate,
    },
    planChapter: { findMany: chapterFindMany },
  };
  const $transaction = jest.fn((fn: (client: typeof tx) => unknown) => fn(tx));
  const service = new PlansService(
    {
      levelingPlan: { deleteMany, findFirst },
      $transaction,
    } as unknown as PrismaService,
    clock,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    $transaction.mockImplementation((fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  describe('remove', () => {
    it('apaga dentro do escopo, só rascunho sem atribuições', async () => {
      deleteMany.mockResolvedValue({ count: 1 });
      await service.remove(3, user(Role.Teacher, 9));
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          id: 3,
          status: 'draft',
          assignments: { none: {} },
          AND: [{ teacherId: 9 }],
        },
      });
    });

    it('plano visível que não é rascunho responde 409', async () => {
      deleteMany.mockResolvedValue({ count: 0 });
      findFirst.mockResolvedValue({ id: 3 });
      await expect(service.remove(3, user(Role.Teacher))).rejects.toThrow(
        new BusinessRuleException('Só é possível excluir planos em rascunho.'),
      );
    });

    it('plano fora do escopo responde 404', async () => {
      deleteMany.mockResolvedValue({ count: 0 });
      findFirst.mockResolvedValue(null);
      await expect(service.remove(3, user(Role.Teacher))).rejects.toThrow(
        new NotFoundException('Plano não encontrado.'),
      );
    });
  });

  describe('publish', () => {
    it('plano de outro professor: 404 sem consultar capítulos', async () => {
      updateMany.mockResolvedValue({ count: 0 });
      await expect(service.publish(3, user(Role.Teacher, 9))).rejects.toThrow(
        NotFoundException,
      );
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ id: 3 }, { teacherId: 9 }] },
        }),
      );
      expect(chapterFindMany).not.toHaveBeenCalled();
    });

    it('capítulo sem questões impede a publicação', async () => {
      updateMany.mockResolvedValue({ count: 1 });
      findUniqueOrThrow.mockResolvedValue({
        id: 3,
        subjectId: 1,
        status: 'draft',
      });
      chapterFindMany.mockResolvedValue([
        { _count: { questions: 2 } },
        { _count: { questions: 0 } },
      ]);
      await expect(service.publish(3, user(Role.Teacher))).rejects.toThrow(
        new BusinessRuleException(
          'Adicione ao menos um capítulo com questões antes de publicar.',
        ),
      );
      expect(planUpdate).not.toHaveBeenCalled();
    });

    it('sem capítulos também impede a publicação', async () => {
      updateMany.mockResolvedValue({ count: 1 });
      findUniqueOrThrow.mockResolvedValue({
        id: 3,
        subjectId: 1,
        status: 'draft',
      });
      chapterFindMany.mockResolvedValue([]);
      await expect(service.publish(3, user(Role.Teacher))).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });
});
