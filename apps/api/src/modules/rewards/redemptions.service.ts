import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiMyRedemption,
  ApiRedeemResult,
  ApiRedemption,
  Paginated,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import { ListMyRedemptionsQuery } from 'src/modules/rewards/dto/list-my-redemptions.query';
import { ListRedemptionsQuery } from 'src/modules/rewards/dto/list-redemptions.query';
import { RejectRedemptionDto } from 'src/modules/rewards/dto/reject-redemption.dto';
import {
  presentMyRedemption,
  presentRedemption,
} from 'src/modules/rewards/presenters/redemption.presenter';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CoinLedger, lockStudentProfile } from 'src/shared/coins/coin-ledger';
import { BusinessRuleException } from 'src/shared/exceptions/business-rule.exception';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { studentScope } from 'src/shared/scopes/student-scope';

const REWARD_NOT_FOUND = 'Prêmio não encontrado.';
const REDEMPTION_NOT_FOUND = 'Resgate não encontrado.';
const FINISHED = 'Este resgate já foi finalizado.';

const MINE = {
  reward: { select: { id: true, name: true, imagePath: true } },
} satisfies Prisma.RewardRedemptionInclude;

/** Inclui as matrículas só nas turmas que quem consulta pode ver. */
const staffInclude = (user: AuthUser) =>
  ({
    ...MINE,
    student: {
      select: {
        id: true,
        name: true,
        enrollments: {
          where: { classroom: classroomScope(user) },
          select: { classroom: { select: { id: true, name: true } } },
          orderBy: [{ classroom: { name: 'asc' } }, { classroomId: 'asc' }],
        },
      },
    },
    handler: { select: { id: true, name: true } },
  }) satisfies Prisma.RewardRedemptionInclude;

interface LockedRedemption {
  status: string;
}

@Injectable()
export class RedemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coins: CoinLedger,
    private readonly images: RewardImageService,
  ) {}

  /**
   * Resgate pelo aluno, numa única transação.
   *
   * Ordem de travas (regra do projeto, ver `docs/architecture.md`): perfil do
   * aluno `FOR UPDATE` (primeiro lock, o mesmo do `CoinLedger`), depois o
   * prêmio `FOR UPDATE`. Com as duas linhas travadas, as checagens (ativo,
   * estoque, saldo) valem até o commit: dois resgates do mesmo aluno se
   * serializam no perfil e a última unidade disputada por dois alunos se
   * serializa no prêmio. O `debit` do ledger trava o perfil de novo (sem
   * custo) e mantém o próprio "Saldo insuficiente." como rede de segurança.
   */
  async redeem(user: AuthUser, rewardId: number): Promise<ApiRedeemResult> {
    const created = await this.prisma.$transaction(async (tx) => {
      await lockStudentProfile(tx, user.id);
      const rows = await tx.$queryRaw<
        { id: number; price: number; stock: number; active: boolean }[]
      >`
        SELECT "id", "price", "stock", "active" FROM "rewards"
        WHERE "id" = ${rewardId} FOR UPDATE`;
      const reward = rows[0];
      if (!reward?.active) {
        throw new NotFoundException(REWARD_NOT_FOUND);
      }
      if (reward.stock <= 0) {
        throw new BusinessRuleException('Prêmio esgotado.');
      }
      const profile = await tx.studentProfile.findUniqueOrThrow({
        where: { userId: user.id },
        select: { coinsBalance: true },
      });
      if (profile.coinsBalance < reward.price) {
        throw new BusinessRuleException('Saldo insuficiente.');
      }

      await tx.reward.update({
        where: { id: rewardId },
        data: { stock: { decrement: 1 } },
        select: { id: true },
      });
      const redemption = await tx.rewardRedemption.create({
        data: {
          rewardId,
          studentId: user.id,
          pricePaid: reward.price,
        },
        include: MINE,
      });
      const { balance } = await this.coins.debit(tx, {
        studentId: user.id,
        amount: reward.price,
        reason: 'redemption',
        sourceType: 'redemption',
        sourceId: redemption.id,
      });
      return { redemption, balance, stock: reward.stock - 1 };
    });

    return {
      redemption: presentMyRedemption(created.redemption, this.imageUrl),
      coins_balance: created.balance,
      stock: created.stock,
    };
  }

  /** Resgates do próprio aluno, os mais recentes primeiro. */
  async listMine(
    user: AuthUser,
    query: ListMyRedemptionsQuery,
  ): Promise<Paginated<ApiMyRedemption>> {
    const where: Prisma.RewardRedemptionWhereInput = {
      studentId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where,
        include: MINE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toPrismaPage(query),
      }),
      this.prisma.rewardRedemption.count({ where }),
    ]);
    return paginate(
      rows.map((row) => presentMyRedemption(row, this.imageUrl)),
      total,
      query,
    );
  }

  /**
   * Fila da equipe, só de alunos no escopo de quem consulta. Sem `status`, os
   * pendentes; pendentes saem do mais antigo ao mais novo (ordem de
   * atendimento) e os já tratados, do mais recente ao mais antigo.
   */
  async list(
    query: ListRedemptionsQuery,
    user: AuthUser,
  ): Promise<Paginated<ApiRedemption>> {
    const status = query.status ?? 'pending';
    const where: Prisma.RewardRedemptionWhereInput = {
      status,
      student: {
        AND: [
          studentScope(user, query.classroom_id),
          query.search ? { name: containsInsensitive(query.search) } : {},
        ],
      },
    };
    const direction = status === 'pending' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where,
        include: staffInclude(user),
        orderBy: [{ createdAt: direction }, { id: direction }],
        ...toPrismaPage(query),
      }),
      this.prisma.rewardRedemption.count({ where }),
    ]);
    return paginate(
      rows.map((row) => presentRedemption(row, this.imageUrl)),
      total,
      query,
    );
  }

  /** Entrega: sem moedas, então trava só o resgate. */
  async deliver(id: number, user: AuthUser): Promise<ApiRedemption> {
    await this.findInScope(id, user);
    await this.prisma.$transaction(async (tx) => {
      await this.lockPending(tx, id);
      await tx.rewardRedemption.update({
        where: { id },
        data: {
          status: 'delivered',
          handledBy: user.id,
          handledAt: new Date(),
        },
        select: { id: true },
      });
    });
    return this.present(id, user);
  }

  /**
   * Recusa: devolve as moedas (extrato `refund`, uma vez por resgate) e o
   * estoque. Como mexe em moedas, segue a regra de travas: lê o aluno do
   * resgate sem trava, trava o perfil, relê o resgate com `FOR UPDATE` e só
   * então confere que ainda está pendente. O prêmio é travado pelo próprio
   * `UPDATE` atômico do estoque (`stock + 1`).
   */
  async reject(
    id: number,
    dto: RejectRedemptionDto,
    user: AuthUser,
  ): Promise<ApiRedemption> {
    const { studentId, rewardId } = await this.findInScope(id, user);
    await this.prisma.$transaction(async (tx) => {
      await lockStudentProfile(tx, studentId);
      const redemption = await this.lockPending(tx, id);
      await tx.reward.update({
        where: { id: rewardId },
        data: { stock: { increment: 1 } },
        select: { id: true },
      });
      await tx.rewardRedemption.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason: dto.reason,
          handledBy: user.id,
          handledAt: new Date(),
        },
        select: { id: true },
      });
      const refund = await this.coins.credit(tx, {
        studentId,
        amount: redemption.pricePaid,
        reason: 'refund',
        sourceType: 'redemption',
        sourceId: id,
      });
      if (!refund.applied) {
        // O estorno deste resgate já existe: nunca deixar "recusado" sem
        // estorno nem estorno em dobro. O erro desfaz a transação inteira.
        throw new BusinessRuleException(FINISHED);
      }
    });
    return this.present(id, user);
  }

  /** Resgate de aluno do escopo (sem trava); fora dele, 404. */
  private async findInScope(
    id: number,
    user: AuthUser,
  ): Promise<{ studentId: number; rewardId: number }> {
    const found = await this.prisma.rewardRedemption.findFirst({
      where: { id, student: studentScope(user) },
      select: { studentId: true, rewardId: true },
    });
    if (!found) {
      throw new NotFoundException(REDEMPTION_NOT_FOUND);
    }
    return found;
  }

  /** Relê o resgate com `FOR UPDATE` e exige que ainda esteja pendente. */
  private async lockPending(
    tx: Prisma.TransactionClient,
    id: number,
  ): Promise<{ pricePaid: number }> {
    const rows = await tx.$queryRaw<
      (LockedRedemption & { price_paid: number })[]
    >`
      SELECT "status", "price_paid" FROM "reward_redemptions"
      WHERE "id" = ${id} FOR UPDATE`;
    if (rows.length === 0) {
      throw new NotFoundException(REDEMPTION_NOT_FOUND);
    }
    if (rows[0].status !== 'pending') {
      throw new BusinessRuleException(FINISHED);
    }
    return { pricePaid: rows[0].price_paid };
  }

  private async present(id: number, user: AuthUser): Promise<ApiRedemption> {
    const row = await this.prisma.rewardRedemption.findUniqueOrThrow({
      where: { id },
      include: staffInclude(user),
    });
    return presentRedemption(row, this.imageUrl);
  }

  private readonly imageUrl = (imagePath: string | null): string | null =>
    this.images.urlFor(imagePath);
}
