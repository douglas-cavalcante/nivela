import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiCoinTransaction, Paginated } from '@nivela/api-contract';
import {
  presentCoinTransaction,
  type CoinSources,
} from 'src/modules/dashboard/presenters/coin-transaction.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import type { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';
import { studentScope } from 'src/shared/scopes/student-scope';

/** Extrato de moedas: o aluno vê o próprio; a equipe, o dos alunos do seu escopo. */
@Injectable()
export class CoinsService {
  constructor(private readonly prisma: PrismaService) {}

  async forStudentAsStaff(
    studentId: number,
    query: PaginationQueryDto,
    user: AuthUser,
  ): Promise<Paginated<ApiCoinTransaction>> {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, ...studentScope(user) },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Aluno não encontrado.');
    }
    return this.statement(studentId, query);
  }

  forMe(
    user: AuthUser,
    query: PaginationQueryDto,
  ): Promise<Paginated<ApiCoinTransaction>> {
    return this.statement(user.id, query);
  }

  private async statement(
    studentId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<ApiCoinTransaction>> {
    const where = { studentId };
    const [rows, total] = await Promise.all([
      this.prisma.coinTransaction.findMany({
        where,
        // Só o id: todo movimento de um aluno é gravado com o perfil dele
        // travado até o commit, então o id segue a ordem real por aluno
        // (o horário vem de relógios diferentes e pode divergir).
        orderBy: { id: 'desc' },
        ...toPrismaPage(query),
      }),
      this.prisma.coinTransaction.count({ where }),
    ]);
    const sources = await this.loadSources(rows);
    return paginate(
      rows.map((row) => presentCoinTransaction(row, sources)),
      total,
      query,
    );
  }

  /** Uma consulta por tipo de origem, para a página inteira (sem N+1). */
  private async loadSources(
    rows: Array<{ reason: string; sourceId: number }>,
  ): Promise<CoinSources> {
    const idsOf = (...reasons: string[]) => [
      ...new Set(
        rows.filter((r) => reasons.includes(r.reason)).map((r) => r.sourceId),
      ),
    ];
    const [questions, plans, redemptions] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: idsOf('correct_answer') } },
        select: { id: true, statement: true },
      }),
      this.prisma.levelingPlan.findMany({
        where: { id: { in: idsOf('plan_completed') } },
        select: { id: true, title: true },
      }),
      this.prisma.rewardRedemption.findMany({
        where: { id: { in: idsOf('redemption', 'refund') } },
        select: { id: true, reward: { select: { name: true } } },
      }),
    ]);
    return {
      statements: new Map(questions.map((q) => [q.id, q.statement])),
      planTitles: new Map(plans.map((p) => [p.id, p.title])),
      rewardNames: new Map(redemptions.map((r) => [r.id, r.reward.name])),
    };
  }
}
