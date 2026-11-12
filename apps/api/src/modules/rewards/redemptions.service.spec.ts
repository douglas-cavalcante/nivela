import { NotFoundException } from '@nestjs/common';
import { RedemptionsService } from 'src/modules/rewards/redemptions.service';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { Role } from 'src/shared/enums/role.enum';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';

const student: AuthUser = {
  id: 7,
  name: 'Aluno',
  email: 'aluno@nivela.test',
  role: Role.Student,
};
const teacher: AuthUser = {
  id: 2,
  name: 'Professora',
  email: 'prof@nivela.test',
  role: Role.Teacher,
};

const NOW = new Date('2026-11-11T12:00:00Z');

const redemptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 55,
  rewardId: 10,
  studentId: 7,
  pricePaid: 30,
  status: 'pending',
  handledAt: null,
  rejectionReason: null,
  createdAt: NOW,
  reward: { id: 10, name: 'Caderno', imagePath: null },
  student: { id: 7, name: 'Aluno', enrollments: [] },
  handler: null,
  ...overrides,
});

/** Registra a ordem em que cada trava e cada gravação acontece. */
function setup() {
  const order: string[] = [];
  const state = {
    reward: { id: 10, name: 'Caderno', price: 30, stock: 2, active: true },
    balance: 100,
    redemptionStatus: 'pending',
  };

  const queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('"student_profiles"') && sql.includes('FOR UPDATE')) {
      order.push('lock:profile');
      return Promise.resolve([{ user_id: 7 }]);
    }
    if (sql.includes('"reward_redemptions"') && sql.includes('FOR UPDATE')) {
      order.push('lock:redemption');
      return Promise.resolve([
        {
          status: state.redemptionStatus,
          price_paid: 30,
          reward_id: 10,
          student_id: 7,
        },
      ]);
    }
    if (sql.includes('"rewards"') && sql.includes('FOR UPDATE')) {
      order.push('lock:reward');
      return Promise.resolve(
        state.reward
          ? [
              {
                id: state.reward.id,
                price: state.reward.price,
                stock: state.reward.stock,
                active: state.reward.active,
              },
            ]
          : [],
      );
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });

  const tx = {
    $queryRaw: queryRaw,
    studentProfile: {
      findUniqueOrThrow: jest.fn(() => {
        order.push('read:balance');
        return Promise.resolve({ coinsBalance: state.balance });
      }),
    },
    reward: {
      update: jest.fn(
        ({ data }: { data: { stock: Record<string, number> } }) => {
          order.push('decrement' in data.stock ? 'stock-1' : 'stock+1');
          return Promise.resolve({ stock: state.reward.stock - 1 });
        },
      ),
      findUniqueOrThrow: jest.fn(() => Promise.resolve({ stock: 1 })),
    },
    rewardRedemption: {
      create: jest.fn(() => {
        order.push('redemption.create');
        return Promise.resolve(redemptionRow());
      }),
      update: jest.fn(() => {
        order.push('redemption.update');
        return Promise.resolve(redemptionRow());
      }),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(redemptionRow())),
    },
  };

  const findFirst = jest.fn(() => {
    order.push('read:redemption (sem trava)');
    return Promise.resolve({ studentId: 7, rewardId: 10 });
  });
  const transaction = jest.fn((fn: (client: unknown) => unknown) => fn(tx));
  const debit = jest.fn(() => {
    order.push('ledger.debit');
    return Promise.resolve({ balance: 70 });
  });
  const credit = jest.fn(() => {
    order.push('ledger.credit');
    return Promise.resolve({ applied: true, balance: 100 });
  });

  const service = new RedemptionsService(
    {
      $transaction: transaction,
      rewardRedemption: {
        findFirst,
        findUniqueOrThrow: tx.rewardRedemption.findUniqueOrThrow,
      },
    } as unknown as PrismaService,
    { debit, credit } as unknown as CoinLedger,
    { urlFor: jest.fn(() => null) } as unknown as RewardImageService,
  );
  return { service, order, state, tx, debit, credit, findFirst };
}

describe('RedemptionsService', () => {
  describe('redeem', () => {
    it('trava o perfil antes do prêmio, confere e só então baixa o estoque, cria o resgate e debita', async () => {
      const { service, order, debit } = setup();
      await service.redeem(student, 10);
      expect(order).toEqual([
        'lock:profile',
        'lock:reward',
        'read:balance',
        'stock-1',
        'redemption.create',
        'ledger.debit',
      ]);
      expect(debit).toHaveBeenCalledWith(expect.anything(), {
        studentId: 7,
        amount: 30,
        reason: 'redemption',
        sourceType: 'redemption',
        sourceId: 55,
      });
    });

    it('prêmio inativo ou ausente: 404 sem gravar nada', async () => {
      const inactive = setup();
      inactive.state.reward.active = false;
      await expect(inactive.service.redeem(student, 10)).rejects.toThrow(
        new NotFoundException('Prêmio não encontrado.'),
      );
      expect(inactive.order).toEqual(['lock:profile', 'lock:reward']);

      const missing = setup();
      (missing.state as { reward: unknown }).reward = null;
      await expect(missing.service.redeem(student, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('esgotado antes de saldo insuficiente; nenhum dos dois grava', async () => {
      const { service, order, state } = setup();
      state.reward.stock = 0;
      state.balance = 0;
      await expect(service.redeem(student, 10)).rejects.toThrow(
        new BusinessRuleException('Prêmio esgotado.'),
      );
      state.reward.stock = 1;
      await expect(service.redeem(student, 10)).rejects.toThrow(
        new BusinessRuleException('Saldo insuficiente.'),
      );
      expect(order).not.toContain('stock-1');
      expect(order).not.toContain('redemption.create');
      expect(order).not.toContain('ledger.debit');
    });
  });

  describe('reject', () => {
    it('lê o resgate sem trava e então trava perfil, resgate, devolve estoque, finaliza e credita o estorno', async () => {
      const { service, order, credit, findFirst } = setup();
      await service.reject(55, { reason: 'Sem estoque.' }, teacher);
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(order).toEqual([
        'read:redemption (sem trava)',
        'lock:profile',
        'lock:redemption',
        'stock+1',
        'redemption.update',
        'ledger.credit',
      ]);
      expect(credit).toHaveBeenCalledWith(expect.anything(), {
        studentId: 7,
        amount: 30,
        reason: 'refund',
        sourceType: 'redemption',
        sourceId: 55,
      });
    });

    it('resgate já finalizado depois da trava: 409 sem devolver estoque nem moedas', async () => {
      const { service, order, state } = setup();
      state.redemptionStatus = 'rejected';
      await expect(
        service.reject(55, { reason: 'Sem estoque.' }, teacher),
      ).rejects.toThrow(
        new BusinessRuleException('Este resgate já foi finalizado.'),
      );
      expect(order).toEqual([
        'read:redemption (sem trava)',
        'lock:profile',
        'lock:redemption',
      ]);
    });

    it('estorno já existente (applied: false): lança o erro para a transação desfazer tudo', async () => {
      const { service, credit } = setup();
      credit.mockResolvedValueOnce({ applied: false, balance: 100 });
      await expect(
        service.reject(55, { reason: 'Sem estoque.' }, teacher),
      ).rejects.toThrow(
        new BusinessRuleException('Este resgate já foi finalizado.'),
      );
    });

    it('fora do escopo: 404 antes de abrir a transação', async () => {
      const { service, findFirst, order } = setup();
      findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.reject(55, { reason: 'Sem estoque.' }, teacher),
      ).rejects.toThrow(new NotFoundException('Resgate não encontrado.'));
      expect(order).toEqual([]);
    });
  });

  describe('deliver', () => {
    it('trava só o resgate: nunca o perfil nem o prêmio', async () => {
      const { service, order, credit } = setup();
      await service.deliver(55, teacher);
      expect(order).toEqual([
        'read:redemption (sem trava)',
        'lock:redemption',
        'redemption.update',
      ]);
      expect(credit).not.toHaveBeenCalled();
    });

    it('já finalizado: 409', async () => {
      const { service, state } = setup();
      state.redemptionStatus = 'delivered';
      await expect(service.deliver(55, teacher)).rejects.toThrow(
        new BusinessRuleException('Este resgate já foi finalizado.'),
      );
    });
  });
});
