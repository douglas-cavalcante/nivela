import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiStudent,
  ApiStudentSummary,
  Paginated,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import { ListStudentsQuery } from 'src/modules/students/dto/list-students.query';
import {
  presentStudent,
  presentStudentSummary,
} from 'src/modules/students/presenters/student.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { studentScope } from 'src/shared/scopes/student-scope';

const NOT_FOUND = 'Aluno não encontrado.';

/**
 * Perfil e matrículas. As matrículas devolvidas passam pelo mesmo escopo de
 * turmas: um professor não descobre em quais turmas de outros o aluno está.
 */
const includeFor = (user: AuthUser) =>
  ({
    studentProfile: true,
    enrollments: {
      where: { classroom: classroomScope(user) },
      select: { classroom: { select: { id: true, name: true } } },
      orderBy: [{ classroom: { name: 'asc' } }, { classroomId: 'asc' }],
    },
  }) satisfies Prisma.UserInclude;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListStudentsQuery,
    user: AuthUser,
  ): Promise<Paginated<ApiStudentSummary>> {
    const search: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: containsInsensitive(query.search) },
            { email: containsInsensitive(query.search) },
          ],
        }
      : {};
    const where: Prisma.UserWhereInput = {
      AND: [studentScope(user, query.classroom_id), search],
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: includeFor(user),
        ...toPrismaPage(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map(presentStudentSummary), total, query);
  }

  /** 404 se o aluno não existe ou não é visível para quem pede. */
  async findOne(id: number, user: AuthUser): Promise<ApiStudent> {
    const student = await this.prisma.user.findFirst({
      where: { AND: [{ id }, studentScope(user)] },
      include: includeFor(user),
    });
    if (!student) {
      throw new NotFoundException(NOT_FOUND);
    }
    return presentStudent(student);
  }
}
