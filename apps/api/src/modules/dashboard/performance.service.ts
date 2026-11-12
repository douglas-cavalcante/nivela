import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApiCategoryPerformance, ApiList } from '@nivela/api-contract';
import type { SubjectColorKey } from '@nivela/api-contract';
import {
  accuracyOf,
  contextsCte,
} from 'src/modules/dashboard/attempt-contexts';
import { scopedStudentIds } from 'src/modules/dashboard/student-ids';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { studentScope } from 'src/shared/scopes/student-scope';

interface CategoryRow {
  category_id: number;
  category_name: string;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  finished: number;
  correct: number;
}

/** Desempenho por categoria: todo o histórico (não só os últimos 30 dias). */
@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async forClassroom(
    classroomId: number,
    user: AuthUser,
  ): Promise<ApiList<ApiCategoryPerformance>> {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, ...classroomScope(user) },
      select: { id: true },
    });
    if (!classroom) {
      throw new NotFoundException('Turma não encontrada.');
    }
    const ids = await scopedStudentIds(this.prisma, user, classroomId);
    return this.byCategory(ids);
  }

  async forStudent(
    studentId: number,
    user: AuthUser,
  ): Promise<ApiList<ApiCategoryPerformance>> {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, ...studentScope(user) },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Aluno não encontrado.');
    }
    return this.byCategory([studentId]);
  }

  private async byCategory(
    ids: number[],
  ): Promise<ApiList<ApiCategoryPerformance>> {
    const rows = await this.prisma.$queryRaw<CategoryRow[]>(Prisma.sql`
      WITH ${contextsCte(ids)}
      SELECT cat.id AS category_id, cat.name AS category_name,
             s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
             (count(*) FILTER (WHERE c.finished_at IS NOT NULL))::int AS finished,
             (count(*) FILTER (WHERE c.correct))::int AS correct
      FROM contexts c
      JOIN questions q ON q.id = c.question_id
      JOIN categories cat ON cat.id = q.category_id
      JOIN subjects s ON s.id = q.subject_id
      GROUP BY cat.id, cat.name, s.id, s.name, s.color
      ORDER BY s.name ASC, cat.name ASC, cat.id ASC`);
    return {
      data: rows.map((row) => ({
        category: { id: row.category_id, name: row.category_name },
        subject: {
          id: row.subject_id,
          name: row.subject_name,
          color: row.subject_color as SubjectColorKey,
        },
        finished: row.finished,
        correct: row.correct,
        accuracy: accuracyOf(row.correct, row.finished),
      })),
    };
  }
}
