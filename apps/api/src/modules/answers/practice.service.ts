import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApiChapterNext,
  ApiPracticeNext,
  ApiPracticeSubject,
  SubjectColorKey,
  SubjectIconKey,
} from '@nivela/api-contract';
import type { Prisma } from 'src/generated/prisma/client';
import { PracticeNextQuery } from 'src/modules/answers/dto/practice-next.query';
import {
  presentStudentQuestion,
  STUDENT_QUESTION_SELECT,
} from 'src/modules/answers/presenters/student-question.presenter';
import { StudentPlansService } from 'src/modules/leveling-plans/student-plans.service';
import { QuestionImageService } from 'src/modules/questions/question-image.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';

/** Tentativas por questão e contexto (RN03). */
const MAX_ATTEMPTS = 2;

/** Questões que o aluno ainda não terminou na prática (nem acertou, nem esgotou as tentativas). */
const notFinished = (studentId: number): Prisma.QuestionWhereInput => ({
  attempts: {
    none: {
      studentId,
      planChapterId: null,
      OR: [{ isCorrect: true }, { attemptNumber: MAX_ATTEMPTS }],
    },
  },
});

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: QuestionImageService,
    private readonly plans: StudentPlansService,
  ) {}

  /**
   * Disciplinas e categorias que têm questões ativas. `available_questions`
   * conta só as que o aluno ainda não terminou (0 = tudo concluído).
   */
  async subjects(user: AuthUser): Promise<ApiPracticeSubject[]> {
    const by: ('subjectId' | 'categoryId')[] = ['subjectId', 'categoryId'];
    const [active, available] = await Promise.all([
      this.prisma.question.groupBy({
        by,
        where: { active: true },
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by,
        where: { active: true, ...notFinished(user.id) },
        _count: { id: true },
      }),
    ]);
    const availableByCategory = new Map(
      available.map((row) => [row.categoryId, row._count.id]),
    );
    const categoryIds = active.map((row) => row.categoryId);
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: [...new Set(active.map((row) => row.subjectId))] } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        categories: {
          where: { id: { in: categoryIds } },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true },
        },
      },
    });
    return subjects.map((subject) => {
      const categories = subject.categories.map((category) => ({
        id: category.id,
        name: category.name,
        available_questions: availableByCategory.get(category.id) ?? 0,
      }));
      return {
        id: subject.id,
        name: subject.name,
        color: subject.color as SubjectColorKey,
        icon: subject.icon as SubjectIconKey,
        available_questions: categories.reduce(
          (sum, category) => sum + category.available_questions,
          0,
        ),
        categories,
      } satisfies ApiPracticeSubject;
    });
  }

  /** Próxima questão ativa ainda não terminada (menor id) da disciplina/categoria. */
  async next(
    user: AuthUser,
    query: PracticeNextQuery,
  ): Promise<ApiPracticeNext> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: query.subject_id },
      select: { id: true },
    });
    if (!subject) {
      throw new NotFoundException('Disciplina não encontrada.');
    }
    if (query.category_id !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: { id: query.category_id, subjectId: subject.id },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException('Categoria não encontrada.');
      }
    }

    const where: Prisma.QuestionWhereInput = {
      active: true,
      subjectId: subject.id,
      ...(query.category_id === undefined
        ? {}
        : { categoryId: query.category_id }),
      ...notFinished(user.id),
    };
    const [row, remaining] = await Promise.all([
      this.prisma.question.findFirst({
        where,
        orderBy: { id: 'asc' },
        select: STUDENT_QUESTION_SELECT,
      }),
      this.prisma.question.count({ where }),
    ]);
    if (!row) {
      return { question: null, remaining: 0 };
    }
    const used = await this.prisma.questionAttempt.count({
      where: { studentId: user.id, questionId: row.id, planChapterId: null },
    });
    const attemptsLeft = Math.max(1, MAX_ATTEMPTS - used) as 1 | 2;
    return {
      question: presentStudentQuestion(
        row,
        this.images.urlFor(row.imagePath),
        attemptsLeft,
      ),
      remaining,
    };
  }
  /**
   * Próxima questão ativa do capítulo (pela posição) que o aluno ainda não
   * terminou NESTE capítulo; a prática livre não conta (contextos separados).
   */
  async chapterNext(
    user: AuthUser,
    planId: number,
    chapterId: number,
  ): Promise<ApiChapterNext> {
    await this.plans.openChapter(user.id, planId, chapterId);
    const where: Prisma.ChapterQuestionWhereInput = {
      planChapterId: chapterId,
      question: {
        active: true,
        attempts: {
          none: {
            studentId: user.id,
            planChapterId: chapterId,
            OR: [{ isCorrect: true }, { attemptNumber: MAX_ATTEMPTS }],
          },
        },
      },
    };
    const [row, remaining] = await Promise.all([
      this.prisma.chapterQuestion.findFirst({
        where,
        orderBy: [{ position: 'asc' }, { questionId: 'asc' }],
        select: { question: { select: STUDENT_QUESTION_SELECT } },
      }),
      this.prisma.chapterQuestion.count({ where }),
    ]);
    if (!row) {
      return { question: null, remaining: 0 };
    }
    const used = await this.prisma.questionAttempt.count({
      where: {
        studentId: user.id,
        questionId: row.question.id,
        planChapterId: chapterId,
      },
    });
    const attemptsLeft = Math.max(1, MAX_ATTEMPTS - used) as 1 | 2;
    return {
      question: presentStudentQuestion(
        row.question,
        this.images.urlFor(row.question.imagePath),
        attemptsLeft,
      ),
      remaining,
    };
  }
}
