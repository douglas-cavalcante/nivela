import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import type {
  ApiStudent,
  ApiStudentSummary,
  Paginated,
} from '@nivela/api-contract';
import { Prisma, type User } from 'src/generated/prisma/client';
import { ListStudentsQuery } from 'src/modules/students/dto/list-students.query';
import {
  presentStudent,
  presentStudentSummary,
} from 'src/modules/students/presenters/student.presenter';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { CLOCK, type Clock } from 'src/shared/clock/clock';
import { Role } from 'src/shared/enums/role.enum';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { classroomScope } from 'src/shared/scopes/classroom-scope';
import { studentScope } from 'src/shared/scopes/student-scope';
import { BCRYPT_COST } from 'src/shared/security/password';
import { StreakService } from 'src/shared/study/streak.service';

const NOT_FOUND = 'Aluno não encontrado.';

/** Dados de uma conta de aluno nova: a senha já em hash ou em texto (o serviço gera o hash). */
export type NewStudentAccount = { name: string; email: string } & (
  { passwordHash: string } | { password: string }
);

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly streaks: StreakService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Único jeito de criar a conta de um aluno: o usuário (perfil `student`) e
   * o `student_profile` juntos, dentro da transação de quem chama (cadastro
   * pelo app ou matrícula manual). A checagem de e-mail e a matrícula ficam
   * com quem chama.
   */
  async createAccount(
    tx: Prisma.TransactionClient,
    account: NewStudentAccount,
  ): Promise<User> {
    const password =
      'passwordHash' in account
        ? account.passwordHash
        : await hash(account.password, BCRYPT_COST);
    const user = await tx.user.create({
      data: {
        name: account.name.trim(),
        email: account.email,
        password,
        role: Role.Student,
      },
    });
    await tx.studentProfile.create({ data: { userId: user.id } });
    return user;
  }

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
    // Ruling 10: a ficha mostra a sequência efetiva (0 se o aluno pulou um dia).
    const streak = student.studentProfile
      ? this.streaks.effective(student.studentProfile, this.clock.now())
      : { current: 0, best: 0 };
    return presentStudent(student, streak);
  }
}
