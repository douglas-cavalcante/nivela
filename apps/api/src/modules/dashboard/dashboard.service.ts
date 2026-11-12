import { Inject, Injectable } from '@nestjs/common';
import type {
  ApiActivityDay,
  ApiDashboardSummary,
  ApiList,
  ApiQuestionSummary,
  ApiStudentNeedingHelp,
} from '@nivela/api-contract';
import {
  accuracyOf,
  contextsCte,
  finishedWithin,
  HELP_ACCURACY_BELOW,
  HELP_MIN_FINISHED,
  shiftDay,
  windowBounds,
} from 'src/modules/dashboard/attempt-contexts';
import { scopedStudentIds } from 'src/modules/dashboard/student-ids';
import { QuestionsService } from 'src/modules/questions/questions.service';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CLOCK, type Clock } from 'src/shared/clock/clock';
import { studyDay } from 'src/shared/study/study-day';
import { studyDaySql } from 'src/shared/study/study-day.sql';

const NEEDING_HELP_LIMIT = 10;
const RECENT_QUESTIONS = 5;

interface HelpRow {
  student_id: number;
  finished: number;
  correct: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async summary(user: AuthUser): Promise<ApiDashboardSummary> {
    const ids = await scopedStudentIds(this.prisma, user);
    const { from, to } = windowBounds(this.clock.now());
    const [activeStudents, activeQuestions, pending, totals, needingHelp] =
      await Promise.all([
        this.prisma.user.count({ where: { id: { in: ids }, active: true } }),
        this.prisma.question.count({ where: { active: true } }),
        this.prisma.rewardRedemption.count({
          where: { status: 'pending', studentId: { in: ids } },
        }),
        this.prisma.$queryRaw<
          { finished: number; correct: number }[]
        >(Prisma.sql`
          WITH ${contextsCte(ids)}
          SELECT count(*)::int AS finished,
                 (count(*) FILTER (WHERE c.correct))::int AS correct
          FROM contexts c
          WHERE ${finishedWithin(from, to)}`),
        this.needingHelpRows(ids, from, to),
      ]);
    return {
      active_students: activeStudents,
      active_questions: activeQuestions,
      accuracy: accuracyOf(totals[0]?.correct ?? 0, totals[0]?.finished ?? 0),
      students_needing_help: needingHelp.length,
      pending_redemptions: pending,
    };
  }

  /** Um item por dia de estudo (inclusive zeros), do mais antigo ao mais novo. */
  async activity(
    user: AuthUser,
    days: number,
  ): Promise<ApiList<ApiActivityDay>> {
    const ids = await scopedStudentIds(this.prisma, user);
    const to = studyDay(this.clock.now());
    const from = shiftDay(to, -(days - 1));
    const day = studyDaySql('qa.created_at');
    const rows = await this.prisma.$queryRaw<
      { day: string; answered: number; correct: number }[]
    >(Prisma.sql`
      SELECT to_char(${day}, 'YYYY-MM-DD') AS day,
             count(*)::int AS answered,
             (count(*) FILTER (WHERE qa.is_correct))::int AS correct
      FROM question_attempts qa
      WHERE qa.student_id = ANY(${ids}::int[])
        AND ${day} >= ${from}::date AND ${day} <= ${to}::date
      GROUP BY 1`);
    const byDay = new Map(rows.map((row) => [row.day, row]));
    const data: ApiActivityDay[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      const current = shiftDay(from, offset);
      const row = byDay.get(current);
      data.push({
        day: current,
        answered: row?.answered ?? 0,
        correct: row?.correct ?? 0,
      });
    }
    return { data };
  }

  async needingHelp(user: AuthUser): Promise<ApiList<ApiStudentNeedingHelp>> {
    const ids = await scopedStudentIds(this.prisma, user);
    const { from, to } = windowBounds(this.clock.now());
    const rows = (await this.needingHelpRows(ids, from, to)).slice(
      0,
      NEEDING_HELP_LIMIT,
    );
    const students = await this.prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.student_id) } },
      select: { id: true, name: true },
    });
    const names = new Map(students.map((s) => [s.id, s.name]));
    return {
      data: rows.map((row) => ({
        student: { id: row.student_id, name: names.get(row.student_id) ?? '' },
        accuracy: accuracyOf(row.correct, row.finished) ?? 0,
        finished: row.finished,
      })),
    };
  }

  /** Questões mais recentes e ativas do catálogo da escola (não depende do escopo). */
  async recentQuestions(): Promise<ApiList<ApiQuestionSummary>> {
    return { data: await this.questions.recent(RECENT_QUESTIONS) };
  }

  /** Alunos com acerto abaixo do limiar na janela, do menor acerto para o maior. */
  private needingHelpRows(
    ids: number[],
    from: string,
    to: string,
  ): Promise<HelpRow[]> {
    return this.prisma.$queryRaw<HelpRow[]>(Prisma.sql`
      WITH ${contextsCte(ids)}
      SELECT c.student_id,
             count(*)::int AS finished,
             (count(*) FILTER (WHERE c.correct))::int AS correct
      FROM contexts c
      WHERE ${finishedWithin(from, to)}
      GROUP BY c.student_id
      HAVING count(*) >= ${HELP_MIN_FINISHED}
        AND (count(*) FILTER (WHERE c.correct)) * 100
            < count(*) * ${HELP_ACCURACY_BELOW}
      ORDER BY (count(*) FILTER (WHERE c.correct))::float / count(*) ASC,
               count(*) DESC, c.student_id ASC`);
  }
}
