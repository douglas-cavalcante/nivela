// Seed de demonstração: professores, turmas, disciplinas, 24 questões originais,
// planos, prêmios e 8 alunos com 14 dias de histórico (para o vídeo e as capturas
// de tela). Só acrescenta dados e roda uma vez: se `ana.lima@nivela.test` já
// existe, não grava nada. Tudo numa transação (ou tudo, ou nada) e nunca mexe
// no administrador. O dinheiro passa pelo `CoinLedger` e a sequência pelo
// `StreakService`, as mesmas peças da API, então saldo = soma do extrato.
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import { Prisma, PrismaClient } from 'src/generated/prisma/client';
import { CoinLedger } from 'src/shared/coins/coin-ledger';
import { COINS_FIRST_TRY, COINS_SECOND_TRY } from 'src/shared/coins/coin-rules';
import { StreakService } from 'src/shared/study/streak.service';
import { dayNumber, studyDay } from 'src/shared/study/study-day';
import { DEMO_PLANS } from './demo/plans';
import {
  DEMO_CATEGORIES,
  DEMO_QUESTIONS,
  DEMO_SUBJECTS,
  type DemoQuestion,
} from './demo/questions';
import { DEMO_REWARDS } from './demo/rewards';
import {
  DEMO_CLASSROOMS,
  DEMO_PASSWORD,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  type DemoStudent,
  type Outcome,
} from './demo/students';

const MARKER_EMAIL = 'ana.lima@nivela.test';
const MISSING_ADMIN =
  'Administrador não encontrado. Rode npm run db:seed antes.';
const ALREADY_SEEDED = 'Os dados de demonstração já estão no banco.';
const CREATED = 'Dados de demonstração criados.';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
const MS_PER_DAY = 86_400_000;
/** Início das aulas (08:00 em Fortaleza), em minutos do dia. */
const CLASS_START = 8 * 60;
/** Intervalo entre duas questões de um aluno, em minutos. */
const QUESTION_GAP = 45;
/** Segunda tentativa, em segundos depois da primeira. */
const RETRY_AFTER_SECONDS = 45;
/** Hora em que os alunos resgatam (12:30) e em que a equipe responde (10:00). */
const REDEEM_MINUTE = 12 * 60 + 30;
const HANDLE_MINUTE = 10 * 60;

export interface SeedDemoOptions {
  /** Instante de referência: o histórico cobre os 14 dias até ele. */
  now: Date;
}

export interface SeedDemoResult {
  created: boolean;
  message: string;
}

type Tx = Prisma.TransactionClient;

interface QuestionRef {
  id: number;
  def: DemoQuestion;
  correctOptionId: number;
  wrongOptionIds: number[];
}

interface ChapterRef {
  id: number;
  planId: number;
  questions: QuestionRef[];
}

interface PlanRef {
  id: number;
  bonus: number;
  chapters: ChapterRef[];
}

interface Activity {
  question: QuestionRef;
  chapter: ChapterRef | null;
}

interface StudentEvent {
  at: Date;
  run: () => Promise<void>;
}

/** Cria os dados de demonstração. Sem administrador, recusa; já criados, não grava nada. */
export async function seedDemo(
  prisma: PrismaClient,
  { now }: SeedDemoOptions,
): Promise<SeedDemoResult> {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    select: { id: true },
  });
  if (!admin) {
    throw new Error(MISSING_ADMIN);
  }
  const marker = await prisma.user.findUnique({
    where: { email: MARKER_EMAIL },
    select: { id: true },
  });
  if (marker) {
    return { created: false, message: ALREADY_SEEDED };
  }

  const password = await hash(DEMO_PASSWORD, 10);
  await prisma.$transaction((tx) => new Writer(tx, now, password).run(), {
    timeout: 120_000,
    maxWait: 10_000,
  });
  return { created: true, message: CREATED };
}

function isoDay(number: number): string {
  return new Date(number * MS_PER_DAY).toISOString().slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

class Writer {
  private readonly ledger = new CoinLedger();
  private readonly streaks = new StreakService(this.ledger);
  private readonly today: number;
  /** Questões que já renderam moedas, por aluno (uma vez por questão, em qualquer contexto). */
  private readonly coined = new Map<number, Set<number>>();
  /** Questões terminadas em capítulos, por aluno ("capítulo:questão"). */
  private readonly finished = new Map<number, Set<string>>();
  private readonly doneChapters = new Map<number, Set<number>>();

  constructor(
    private readonly tx: Tx,
    private readonly now: Date,
    private readonly password: string,
  ) {
    this.today = dayNumber(studyDay(now));
  }

  /** Horário de aula em Fortaleza (UTC−3, sem horário de verão) `daysAgo` dias atrás; nunca depois de `now`. */
  private at(daysAgo: number, minuteOfDay: number): Date {
    const day = isoDay(this.today - daysAgo);
    const time = `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
    const instant = new Date(`${day}T${time}:00-03:00`);
    return instant > this.now
      ? new Date(this.now.getTime() - (1440 - minuteOfDay) * 1000)
      : instant;
  }

  async run(): Promise<void> {
    const { tx } = this;
    const teachers = new Map<string, number>();
    for (const [index, teacher] of DEMO_TEACHERS.entries()) {
      const user = await tx.user.create({
        data: {
          name: teacher.name,
          email: teacher.email,
          password: this.password,
          role: 'teacher',
          createdAt: this.at(20, 480 + index),
        },
      });
      teachers.set(teacher.email, user.id);
    }
    const ana = this.teacher(teachers, DEMO_TEACHERS[0].email);
    const bruno = this.teacher(teachers, DEMO_TEACHERS[1].email);

    const classrooms = new Map<string, { id: number; teacherId: number }>();
    for (const [index, classroom] of DEMO_CLASSROOMS.entries()) {
      const teacherId = this.teacher(teachers, classroom.teacher);
      const created = await tx.classroom.create({
        data: {
          teacherId,
          name: classroom.name,
          schoolYear: classroom.schoolYear,
          joinCode: classroom.joinCode,
          createdAt: this.at(16, 480 + index),
        },
      });
      classrooms.set(classroom.key, { id: created.id, teacherId });
    }

    const questions = await this.createQuestions(ana, bruno);
    const plans = await this.createPlans(ana, questions, classrooms);

    const rewards = new Map<string, { id: number; price: number }>();
    for (const [index, reward] of DEMO_REWARDS.entries()) {
      const created = await tx.reward.create({
        data: {
          createdBy: ana,
          name: reward.name,
          description: reward.description,
          price: reward.price,
          stock: reward.stock,
          active: reward.active,
          createdAt: this.at(15, 480 + index),
        },
      });
      rewards.set(reward.name, { id: created.id, price: reward.price });
    }

    for (const [index, student] of DEMO_STUDENTS.entries()) {
      await this.createStudent(student, index, {
        classrooms,
        questions,
        plans,
        rewards,
      });
    }
  }

  private teacher(teachers: Map<string, number>, email: string): number {
    const id = teachers.get(email);
    if (id === undefined) {
      throw new Error(`Professor ${email} não foi criado.`);
    }
    return id;
  }

  private async createQuestions(
    ana: number,
    bruno: number,
  ): Promise<QuestionRef[]> {
    const { tx } = this;
    const subjectIds = new Map<string, number>();
    const categoryIds = new Map<string, number>();
    for (const [index, subject] of DEMO_SUBJECTS.entries()) {
      const created = await tx.subject.create({
        data: {
          name: subject.name,
          color: subject.color,
          icon: subject.icon,
          createdAt: this.at(16, 500 + index),
        },
      });
      subjectIds.set(subject.name, created.id);
      for (const name of DEMO_CATEGORIES[subject.name]) {
        const category = await tx.category.create({
          data: { subjectId: created.id, name },
        });
        categoryIds.set(`${subject.name}/${name}`, category.id);
      }
    }

    const refs: QuestionRef[] = [];
    for (const [index, def] of DEMO_QUESTIONS.entries()) {
      const subjectId = subjectIds.get(def.subject);
      const categoryId = categoryIds.get(`${def.subject}/${def.category}`);
      if (subjectId === undefined || categoryId === undefined) {
        throw new Error(
          `Questão ${index + 1} com disciplina ou categoria inválida.`,
        );
      }
      const created = await tx.question.create({
        data: {
          authorId: def.subject === 'Matemática' ? ana : bruno,
          subjectId,
          categoryId,
          statement: def.statement,
          difficulty: def.difficulty,
          explanation: def.explanation,
          createdAt: this.at(15, 480 + index),
          options: {
            create: def.options.map((text, position) => ({
              letter: LETTERS[position],
              text,
              isCorrect: position === def.correct,
            })),
          },
        },
        include: { options: true },
      });
      const correct = created.options.find((option) => option.isCorrect);
      if (!correct) {
        throw new Error(`Questão ${index + 1} sem alternativa correta.`);
      }
      refs.push({
        id: created.id,
        def,
        correctOptionId: correct.id,
        wrongOptionIds: created.options
          .filter((option) => !option.isCorrect)
          .map((option) => option.id),
      });
    }
    return refs;
  }

  private async createPlans(
    ana: number,
    questions: QuestionRef[],
    classrooms: Map<string, { id: number }>,
  ): Promise<Map<string, PlanRef>> {
    const { tx } = this;
    const subjects = await tx.subject.findMany({
      select: { id: true, name: true },
    });
    const plans = new Map<string, PlanRef>();
    for (const [planIndex, plan] of DEMO_PLANS.entries()) {
      const subject = subjects.find((item) => item.name === plan.subject);
      if (!subject) {
        throw new Error(`Disciplina ${plan.subject} não encontrada.`);
      }
      const created = await tx.levelingPlan.create({
        data: {
          teacherId: ana,
          subjectId: subject.id,
          title: plan.title,
          description: plan.description,
          completionBonus: plan.completionBonus,
          status: 'published',
          publishedAt: this.at(15, 600 + planIndex),
          createdAt: this.at(15, 590 + planIndex),
        },
      });
      const chapters: ChapterRef[] = [];
      for (const [chapterIndex, chapter] of plan.chapters.entries()) {
        const members = questions.filter(
          (question) =>
            question.def.subject === plan.subject &&
            question.def.category === chapter.category,
        );
        const createdChapter = await tx.planChapter.create({
          data: {
            levelingPlanId: created.id,
            title: chapter.title,
            position: chapterIndex + 1,
          },
        });
        await tx.chapterQuestion.createMany({
          data: members.map((question, position) => ({
            planChapterId: createdChapter.id,
            questionId: question.id,
            position: position + 1,
          })),
        });
        chapters.push({
          id: createdChapter.id,
          planId: created.id,
          questions: members,
        });
      }
      plans.set(plan.key, {
        id: created.id,
        bonus: plan.completionBonus,
        chapters,
      });
      for (const key of plan.classrooms) {
        const classroom = classrooms.get(key);
        if (!classroom) {
          throw new Error(`Turma ${key} não encontrada.`);
        }
        await tx.planAssignment.create({
          data: {
            levelingPlanId: created.id,
            classroomId: classroom.id,
            dueDate: new Date(`${isoDay(this.today + 7)}T00:00:00Z`),
            createdAt: this.at(14, 700),
          },
        });
      }
    }
    return plans;
  }

  private async createStudent(
    student: DemoStudent,
    index: number,
    refs: {
      classrooms: Map<string, { id: number; teacherId: number }>;
      questions: QuestionRef[];
      plans: Map<string, PlanRef>;
      rewards: Map<string, { id: number; price: number }>;
    },
  ): Promise<void> {
    const { tx } = this;
    const classroom = refs.classrooms.get(student.classroom);
    if (!classroom) {
      throw new Error(`Turma ${student.classroom} não encontrada.`);
    }
    const user = await tx.user.create({
      data: {
        name: student.name,
        email: student.email,
        password: this.password,
        role: 'student',
        createdAt: this.at(14, 480 + index),
        studentProfile: { create: {} },
      },
    });
    await tx.classroomStudent.create({
      data: {
        classroomId: classroom.id,
        studentId: user.id,
        joinedAt: this.at(14, 500 + index),
      },
    });

    const events: StudentEvent[] = [];
    const queue = this.queueFor(student, refs.questions, refs.plans);
    let outcomeIndex = 0;
    let next = 0;
    for (let daysAgo = student.daily.length - 1; daysAgo >= 0; daysAgo -= 1) {
      for (let slot = 0; slot < student.daily[daysAgo]; slot += 1) {
        const activity = queue[next];
        if (!activity) {
          throw new Error(`Faltam questões para ${student.email}.`);
        }
        next += 1;
        const outcome = student.pattern[outcomeIndex % student.pattern.length];
        const wrongPick = outcomeIndex;
        outcomeIndex += 1;
        const at = this.at(
          daysAgo,
          CLASS_START + (index % 3) * 20 + slot * QUESTION_GAP,
        );
        events.push({
          at,
          run: () =>
            this.answer(user.id, activity, outcome, wrongPick, at, refs.plans),
        });
      }
    }

    for (const redemption of student.redemptions) {
      const reward = refs.rewards.get(redemption.reward);
      if (!reward) {
        throw new Error(`Prêmio ${redemption.reward} não encontrado.`);
      }
      const requestedAt = this.at(redemption.daysAgo, REDEEM_MINUTE);
      let redemptionId = 0;
      events.push({
        at: requestedAt,
        run: async () => {
          await tx.reward.update({
            where: { id: reward.id },
            data: { stock: { decrement: 1 } },
          });
          const created = await tx.rewardRedemption.create({
            data: {
              rewardId: reward.id,
              studentId: user.id,
              pricePaid: reward.price,
              createdAt: requestedAt,
              updatedAt: requestedAt,
            },
          });
          redemptionId = created.id;
          await this.ledger.debit(tx, {
            studentId: user.id,
            amount: reward.price,
            reason: 'redemption',
            sourceType: 'redemption',
            sourceId: created.id,
          });
          await this.stamp(user.id, 'redemption', created.id, requestedAt);
        },
      });
      if (redemption.status === 'pending') {
        continue;
      }
      if (redemption.daysAgo < 1) {
        throw new Error('Um resgate tratado precisa ter pelo menos um dia.');
      }
      const handledAt = this.at(redemption.daysAgo - 1, HANDLE_MINUTE);
      events.push({
        at: handledAt,
        run: async () => {
          const rejected = redemption.status === 'rejected';
          await tx.rewardRedemption.update({
            where: { id: redemptionId },
            data: {
              status: redemption.status,
              handledBy: classroom.teacherId,
              handledAt,
              updatedAt: handledAt,
              ...(rejected ? { rejectionReason: redemption.reason } : {}),
            },
          });
          if (rejected) {
            await tx.reward.update({
              where: { id: reward.id },
              data: { stock: { increment: 1 } },
            });
            await this.ledger.credit(tx, {
              studentId: user.id,
              amount: reward.price,
              reason: 'refund',
              sourceType: 'redemption',
              sourceId: redemptionId,
            });
            await this.stamp(user.id, 'refund', redemptionId, handledAt);
          }
        },
      });
    }

    // Em ordem de horário: o saldo nunca fica negativo no meio do caminho.
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const event of events) {
      await event.run();
    }
  }

  /** Fila do aluno: questões dos planos, em ordem de capítulo, e depois a prática livre. */
  private queueFor(
    student: DemoStudent,
    questions: QuestionRef[],
    plans: Map<string, PlanRef>,
  ): Activity[] {
    const queue: Activity[] = [];
    const inChapters = new Set<number>();
    for (const key of ['math', 'port'] as const) {
      const count = student.planQuestions[key];
      const plan = plans.get(key);
      const assigned = DEMO_PLANS.find((item) => item.key === key)?.classrooms;
      if (count > 0 && !assigned?.includes(student.classroom)) {
        throw new Error(`${student.email} não recebe o plano ${key}.`);
      }
      const flat =
        plan?.chapters.flatMap((chapter) =>
          chapter.questions.map((question) => ({ question, chapter })),
        ) ?? [];
      if (count > flat.length) {
        throw new Error(
          `${student.email} pede mais questões que o plano ${key}.`,
        );
      }
      for (const item of flat.slice(0, count)) {
        queue.push(item);
        inChapters.add(item.question.id);
      }
    }
    const fresh = questions.filter((question) => !inChapters.has(question.id));
    const repeated = questions.filter((question) =>
      inChapters.has(question.id),
    );
    for (const question of [...fresh, ...repeated]) {
      queue.push({ question, chapter: null });
    }
    return queue;
  }

  /** Uma questão terminada: tentativas, moedas, sequência e conclusões, como na API. */
  private async answer(
    studentId: number,
    { question, chapter }: Activity,
    outcome: Outcome,
    wrongPick: number,
    at: Date,
    plans: Map<string, PlanRef>,
  ): Promise<void> {
    const { tx } = this;
    const wrong = (offset: number) =>
      question.wrongOptionIds[
        (wrongPick + offset) % question.wrongOptionIds.length
      ];
    const retryAt = new Date(at.getTime() + RETRY_AFTER_SECONDS * 1000);
    const tries: { optionId: number; correct: boolean; at: Date }[] =
      outcome === 'first'
        ? [{ optionId: question.correctOptionId, correct: true, at }]
        : outcome === 'second'
          ? [
              { optionId: wrong(0), correct: false, at },
              {
                optionId: question.correctOptionId,
                correct: true,
                at: retryAt,
              },
            ]
          : [
              { optionId: wrong(0), correct: false, at },
              { optionId: wrong(1), correct: false, at: retryAt },
            ];
    const finishedAt = tries[tries.length - 1].at;

    const coined = this.coined.get(studentId) ?? new Set<number>();
    this.coined.set(studentId, coined);
    for (const [position, attempt] of tries.entries()) {
      const attemptNumber = position + 1;
      let coinsAwarded = 0;
      if (attempt.correct && !coined.has(question.id)) {
        const amount = attemptNumber === 1 ? COINS_FIRST_TRY : COINS_SECOND_TRY;
        const { applied } = await this.ledger.credit(tx, {
          studentId,
          amount,
          reason: 'correct_answer',
          sourceType: 'question',
          sourceId: question.id,
        });
        if (applied) {
          coinsAwarded = amount;
          coined.add(question.id);
          await this.stamp(
            studentId,
            'correct_answer',
            question.id,
            attempt.at,
          );
        }
      }
      await tx.questionAttempt.create({
        data: {
          studentId,
          questionId: question.id,
          planChapterId: chapter?.id ?? null,
          selectedOptionId: attempt.optionId,
          attemptNumber,
          isCorrect: attempt.correct,
          coinsAwarded,
          createdAt: attempt.at,
        },
      });
    }

    const streak = await this.streaks.register(tx, studentId, finishedAt);
    if (streak.bonus_awarded > 0) {
      await this.stamp(
        studentId,
        'streak_bonus',
        dayNumber(studyDay(finishedAt)),
        finishedAt,
      );
    }
    if (chapter) {
      await this.completeIfDone(
        studentId,
        chapter,
        question,
        finishedAt,
        plans,
      );
    }
  }

  /** Capítulo concluído quando todas as questões terminaram; plano concluído quando todos os capítulos, com o bônus. */
  private async completeIfDone(
    studentId: number,
    chapter: ChapterRef,
    question: QuestionRef,
    at: Date,
    plans: Map<string, PlanRef>,
  ): Promise<void> {
    const { tx } = this;
    const finished = this.finished.get(studentId) ?? new Set<string>();
    this.finished.set(studentId, finished);
    finished.add(`${chapter.id}:${question.id}`);
    if (
      !chapter.questions.every((item) =>
        finished.has(`${chapter.id}:${item.id}`),
      )
    ) {
      return;
    }
    await tx.chapterCompletion.create({
      data: { studentId, planChapterId: chapter.id, completedAt: at },
    });
    const done = this.doneChapters.get(studentId) ?? new Set<number>();
    this.doneChapters.set(studentId, done);
    done.add(chapter.id);

    const plan = [...plans.values()].find((item) => item.id === chapter.planId);
    if (!plan || !plan.chapters.every((item) => done.has(item.id))) {
      return;
    }
    await tx.planCompletion.create({
      data: {
        studentId,
        levelingPlanId: plan.id,
        completedAt: at,
        bonusAwarded: plan.bonus,
      },
    });
    await this.ledger.credit(tx, {
      studentId,
      amount: plan.bonus,
      reason: 'plan_completed',
      sourceType: 'plan',
      sourceId: plan.id,
    });
    await this.stamp(studentId, 'plan_completed', plan.id, at);
  }

  /** O ledger carimba "agora"; o histórico precisa do horário da aula. */
  private async stamp(
    studentId: number,
    reason:
      | 'correct_answer'
      | 'plan_completed'
      | 'streak_bonus'
      | 'redemption'
      | 'refund',
    sourceId: number,
    at: Date,
  ): Promise<void> {
    await this.tx.coinTransaction.updateMany({
      where: { studentId, reason, sourceId },
      data: { createdAt: at },
    });
  }
}

async function main(): Promise<void> {
  config({ quiet: true });
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'Variável de ambiente DATABASE_URL é obrigatória para o seed.',
    );
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const { message } = await seedDemo(prisma, { now: new Date() });
    console.log(message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
