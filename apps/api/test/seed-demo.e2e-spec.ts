import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
// O seed fica em prisma/ (fora de src/), então o alias src/... não o alcança.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { seedDemo } from '../prisma/seed-demo';
import { createTestApp } from './helpers/create-test-app';
import { createUser } from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';
import { TEST_NOW } from './helpers/test-clock';

const PASSWORD = 'nivela123';
const MISSING_ADMIN = /Rode npm run db:seed antes\./;

describe('Seed de demonstração (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const addAdmin = () => createUser(prisma, { role: Role.Admin });
  const login = (email: string, channel: 'web' | 'mobile') =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD, channel });

  /** Contagens de todas as tabelas que o seed grava. */
  async function snapshot() {
    return {
      users: await prisma.user.count(),
      profiles: await prisma.studentProfile.count(),
      classrooms: await prisma.classroom.count(),
      enrollments: await prisma.classroomStudent.count(),
      subjects: await prisma.subject.count(),
      categories: await prisma.category.count(),
      questions: await prisma.question.count(),
      options: await prisma.questionOption.count(),
      plans: await prisma.levelingPlan.count(),
      chapters: await prisma.planChapter.count(),
      chapterQuestions: await prisma.chapterQuestion.count(),
      assignments: await prisma.planAssignment.count(),
      chapterCompletions: await prisma.chapterCompletion.count(),
      planCompletions: await prisma.planCompletion.count(),
      rewards: await prisma.reward.count(),
      redemptions: await prisma.rewardRedemption.count(),
      attempts: await prisma.questionAttempt.count(),
      coins: await prisma.coinTransaction.count(),
    };
  }

  describe('sem o administrador', () => {
    it('recusa com a orientação e não grava nada', async () => {
      await expect(seedDemo(prisma, { now: TEST_NOW })).rejects.toThrow(
        MISSING_ADMIN,
      );
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.question.count()).toBe(0);
    });
  });

  describe('primeira execução', () => {
    beforeEach(async () => {
      await addAdmin();
      await seedDemo(prisma, { now: TEST_NOW });
    });

    it('cria professores, turmas, disciplinas, categorias e prêmios', async () => {
      const teachers = await prisma.user.findMany({
        where: { role: 'teacher' },
        orderBy: { email: 'asc' },
        select: { name: true, email: true },
      });
      expect(teachers).toEqual([
        { name: 'Ana Lima', email: 'ana.lima@nivela.test' },
        { name: 'Bruno Rocha', email: 'bruno.rocha@nivela.test' },
      ]);

      const classrooms = await prisma.classroom.findMany({
        orderBy: { name: 'asc' },
        select: {
          name: true,
          joinCode: true,
          teacher: { select: { email: true } },
          _count: { select: { students: true } },
        },
      });
      expect(classrooms).toEqual([
        {
          name: '1ª série B',
          joinCode: 'NIV-1SER',
          teacher: { email: 'bruno.rocha@nivela.test' },
          _count: { students: 4 },
        },
        {
          name: '9º ano A',
          joinCode: 'NIV-9ANO',
          teacher: { email: 'ana.lima@nivela.test' },
          _count: { students: 4 },
        },
      ]);

      const subjects = await prisma.subject.findMany({
        orderBy: { name: 'asc' },
        select: {
          name: true,
          categories: { orderBy: { name: 'asc' }, select: { name: true } },
        },
      });
      expect(subjects.map((s) => s.name)).toEqual(['Matemática', 'Português']);
      expect(subjects[0].categories.map((c) => c.name)).toEqual([
        'Equações do 1º grau',
        'Frações',
        'Porcentagem',
      ]);
      expect(subjects[1].categories.map((c) => c.name)).toEqual([
        'Concordância',
        'Interpretação de texto',
        'Ortografia',
      ]);

      const rewards = await prisma.reward.findMany();
      expect(rewards.filter((r) => r.active)).toHaveLength(5);
      expect(rewards.filter((r) => !r.active)).toHaveLength(1);
      expect(rewards.every((r) => r.stock >= 0)).toBe(true);
    });

    it('cria 24 questões com 5 alternativas, 1 correta e explicação', async () => {
      const questions = await prisma.question.findMany({
        include: { options: true, category: true },
      });
      expect(questions).toHaveLength(24);
      const perCategory = new Map<string, number>();
      for (const question of questions) {
        expect(question.options.map((o) => o.letter).sort()).toEqual([
          'A',
          'B',
          'C',
          'D',
          'E',
        ]);
        expect(question.options.filter((o) => o.isCorrect)).toHaveLength(1);
        expect(new Set(question.options.map((o) => o.text)).size).toBe(5);
        expect(question.explanation.length).toBeGreaterThan(20);
        expect(question.active).toBe(true);
        perCategory.set(
          question.category.name,
          (perCategory.get(question.category.name) ?? 0) + 1,
        );
      }
      expect([...perCategory.values()]).toEqual([4, 4, 4, 4, 4, 4]);
      expect(new Set(questions.map((q) => q.difficulty)).size).toBe(3);
    });

    it('cria os planos publicados e as atribuições às turmas', async () => {
      const plans = await prisma.levelingPlan.findMany({
        orderBy: { title: 'asc' },
        include: {
          chapters: { include: { _count: { select: { questions: true } } } },
          assignments: { include: { classroom: true } },
        },
      });
      expect(plans.map((p) => [p.title, p.completionBonus, p.status])).toEqual([
        ['Leitura e escrita', 30, 'published'],
        ['Revisão de Matemática para o Ensino Médio', 50, 'published'],
      ]);
      const [reading, math] = plans;
      expect(reading.chapters).toHaveLength(2);
      expect(math.chapters).toHaveLength(3);
      for (const chapter of [...reading.chapters, ...math.chapters]) {
        expect(chapter._count.questions).toBe(4);
      }
      expect(reading.assignments.map((a) => a.classroom?.name)).toEqual([
        '9º ano A',
      ]);
      expect(math.assignments.map((a) => a.classroom?.name).sort()).toEqual([
        '1ª série B',
        '9º ano A',
      ]);
    });

    it('cria 8 alunos, 4 por turma, e o login funciona', async () => {
      const students = await prisma.user.findMany({
        where: { role: 'student' },
        orderBy: { email: 'asc' },
        select: { email: true, active: true },
      });
      expect(students.map((s) => s.email)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `aluno${n}@nivela.test`),
      );
      expect(students.every((s) => s.active)).toBe(true);

      const res = await login('aluno1@nivela.test', 'mobile').expect(200);
      expect(typeof res.body.token).toBe('string');
      await login('ana.lima@nivela.test', 'web').expect(200);
      await login('bruno.rocha@nivela.test', 'web').expect(200);
    });

    it('grava o histórico só dos últimos 14 dias, antes de agora, em horário de aula', async () => {
      const attempts = await prisma.questionAttempt.findMany({
        select: { createdAt: true },
      });
      expect(attempts.length).toBeGreaterThan(100);
      const oldest = TEST_NOW.getTime() - 14 * 86_400_000;
      for (const { createdAt } of attempts) {
        expect(createdAt.getTime()).toBeLessThanOrEqual(TEST_NOW.getTime());
        expect(createdAt.getTime()).toBeGreaterThan(oldest);
      }
      const moves = await prisma.coinTransaction.findMany({
        select: { createdAt: true },
      });
      for (const { createdAt } of moves) {
        expect(createdAt.getTime()).toBeLessThanOrEqual(TEST_NOW.getTime());
        expect(createdAt.getTime()).toBeGreaterThan(oldest);
      }
    });

    it('mantém as tentativas coerentes com as regras', async () => {
      const attempts = await prisma.questionAttempt.findMany({
        orderBy: { id: 'asc' },
      });
      const groups = new Map<string, typeof attempts>();
      for (const attempt of attempts) {
        const key = `${attempt.studentId}:${attempt.questionId}:${attempt.planChapterId}`;
        groups.set(key, [...(groups.get(key) ?? []), attempt]);
      }
      for (const group of groups.values()) {
        expect(group.length).toBeLessThanOrEqual(2);
        expect(group.map((a) => a.attemptNumber)).toEqual(
          group.map((_, i) => i + 1),
        );
        // Nada depois de um acerto.
        expect(group.slice(0, -1).every((a) => !a.isCorrect)).toBe(true);
        for (const attempt of group) {
          expect(attempt.coinsAwarded).toBeLessThanOrEqual(
            attempt.attemptNumber === 1 ? 10 : 5,
          );
          if (!attempt.isCorrect) expect(attempt.coinsAwarded).toBe(0);
        }
      }
    });

    it('fecha as contas: saldo = soma do extrato, sem saldo negativo e com um crédito por origem', async () => {
      const profiles = await prisma.studentProfile.findMany();
      expect(profiles).toHaveLength(8);
      for (const profile of profiles) {
        const { _sum } = await prisma.coinTransaction.aggregate({
          where: { studentId: profile.userId },
          _sum: { amount: true },
        });
        expect(profile.coinsBalance).toBe(_sum.amount ?? 0);
        expect(profile.coinsBalance).toBeGreaterThanOrEqual(0);
      }
      const moves = await prisma.coinTransaction.findMany({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      // Saldo corrente nunca negativo, em ordem cronológica.
      const running = new Map<number, number>();
      for (const move of moves) {
        const total = (running.get(move.studentId) ?? 0) + move.amount;
        expect(total).toBeGreaterThanOrEqual(0);
        running.set(move.studentId, total);
      }
      const keys = moves
        .filter((m) => m.reason !== 'redemption')
        .map((m) => `${m.studentId}:${m.reason}:${m.sourceId}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(
        moves
          .filter((m) => m.reason === 'redemption')
          .every((m) => m.amount < 0),
      ).toBe(true);
    });

    it('confere os motivos e as origens do extrato com as regras', async () => {
      const moves = await prisma.coinTransaction.findMany();
      const reasons = new Set(moves.map((m) => m.reason));
      expect([...reasons].sort()).toEqual([
        'correct_answer',
        'plan_completed',
        'redemption',
        'refund',
        'streak_bonus',
      ]);
      for (const move of moves.filter((m) => m.reason === 'correct_answer')) {
        expect([5, 10]).toContain(move.amount);
        expect(move.sourceType).toBe('question');
        const attempt = await prisma.questionAttempt.findFirst({
          where: {
            studentId: move.studentId,
            questionId: move.sourceId,
            isCorrect: true,
            coinsAwarded: move.amount,
          },
        });
        expect(attempt).not.toBeNull();
      }
      for (const move of moves.filter((m) => m.reason === 'streak_bonus')) {
        expect(move.amount).toBe(20);
        expect(move.sourceType).toBe('study_day');
      }
      const plan = await prisma.coinTransaction.findFirstOrThrow({
        where: { reason: 'plan_completed' },
      });
      expect(plan.sourceType).toBe('plan');
      expect(plan.amount).toBe(50);
      const completions = await prisma.planCompletion.findMany();
      expect(completions).toHaveLength(1);
      expect(completions[0].bonusAwarded).toBe(50);
      expect(completions[0].studentId).toBe(plan.studentId);
    });

    it('mantém sequências coerentes com os dias estudados', async () => {
      const marina = await prisma.user.findUniqueOrThrow({
        where: { email: 'aluno1@nivela.test' },
        include: { studentProfile: true },
      });
      expect(marina.studentProfile?.currentStreak).toBe(14);
      expect(marina.studentProfile?.bestStreak).toBe(14);
      const bonuses = await prisma.coinTransaction.count({
        where: { studentId: marina.id, reason: 'streak_bonus' },
      });
      expect(bonuses).toBe(2);

      const profiles = await prisma.studentProfile.findMany();
      for (const profile of profiles) {
        expect(profile.bestStreak).toBeGreaterThanOrEqual(
          profile.currentStreak,
        );
      }
    });

    it('cria resgates nos três estados, com estoque coerente e estorno nos recusados', async () => {
      const redemptions = await prisma.rewardRedemption.findMany({
        include: { reward: true },
      });
      const byStatus = (status: string) =>
        redemptions.filter((r) => r.status === status);
      expect(byStatus('pending').length).toBeGreaterThanOrEqual(1);
      expect(byStatus('delivered').length).toBeGreaterThanOrEqual(1);
      expect(byStatus('rejected').length).toBeGreaterThanOrEqual(1);

      for (const redemption of redemptions) {
        expect(redemption.pricePaid).toBe(redemption.reward.price);
        const debit = await prisma.coinTransaction.findFirst({
          where: { reason: 'redemption', sourceId: redemption.id },
        });
        expect(debit?.amount).toBe(-redemption.pricePaid);
        if (redemption.status === 'pending') {
          expect(redemption.handledBy).toBeNull();
        } else {
          expect(redemption.handledBy).not.toBeNull();
          expect(redemption.handledAt).not.toBeNull();
        }
      }
      for (const redemption of byStatus('rejected')) {
        expect(redemption.rejectionReason?.length).toBeGreaterThan(5);
        const refunds = await prisma.coinTransaction.findMany({
          where: { reason: 'refund', sourceId: redemption.id },
        });
        expect(refunds).toHaveLength(1);
        expect(refunds[0].amount).toBe(redemption.pricePaid);
      }
      expect(
        await prisma.coinTransaction.count({ where: { reason: 'refund' } }),
      ).toBe(byStatus('rejected').length);

      // Estoque inicial menos os resgates que ficaram (recusado devolve a unidade).
      const rewards = await prisma.reward.findMany();
      for (const reward of rewards) {
        expect(reward.stock).toBeGreaterThanOrEqual(0);
        const held = redemptions.filter(
          (r) => r.rewardId === reward.id && r.status !== 'rejected',
        ).length;
        const original = {
          'Caderno personalizado': 15,
          'Kit marca-texto': 20,
          'Vale-lanche da cantina': 25,
          'Adesivos do Rabisco': 40,
          '15 minutos de leitura livre': 30,
          'Camiseta do Nivela': 0,
        }[reward.name];
        expect(reward.stock).toBe((original ?? -1) - held);
      }
    });

    it('é visível ao professor: indicadores, atividade e "precisam de ajuda"', async () => {
      const token = (await login('ana.lima@nivela.test', 'web').expect(200))
        .body.token as string;
      const get = (path: string) =>
        request(app.getHttpServer())
          .get(`/api/v1${path}`)
          .set({ Authorization: `Bearer ${token}` })
          .expect(200);

      const summary = (await get('/dashboard/summary')).body;
      expect(summary.active_students).toBe(4);
      expect(summary.students_needing_help).toBeGreaterThanOrEqual(1);
      expect(summary.accuracy).toBeGreaterThan(0);
      expect(summary.pending_redemptions).toBeGreaterThanOrEqual(1);

      const help = (await get('/dashboard/needing-help')).body.data as {
        student: { name: string };
        accuracy: number;
        finished: number;
      }[];
      expect(help.map((h) => h.student.name)).toContain('Gabriel Martins');
      expect(help.every((h) => h.accuracy < 50 && h.finished >= 5)).toBe(true);

      const activity = (await get('/dashboard/activity?days=14')).body.data as {
        answered: number;
      }[];
      expect(activity).toHaveLength(14);
      expect(
        activity.filter((d) => d.answered > 0).length,
      ).toBeGreaterThanOrEqual(10);

      const bruno = (await login('bruno.rocha@nivela.test', 'web').expect(200))
        .body.token as string;
      const other = (
        await request(app.getHttpServer())
          .get('/api/v1/dashboard/summary')
          .set({ Authorization: `Bearer ${bruno}` })
          .expect(200)
      ).body;
      expect(other.active_students).toBe(4);
    });

    it('mostra aos alunos o saldo e a sequência gravados', async () => {
      const token = (await login('aluno1@nivela.test', 'mobile').expect(200))
        .body.token as string;
      const stats = (
        await request(app.getHttpServer())
          .get('/api/v1/me/stats')
          .set({ Authorization: `Bearer ${token}` })
          .expect(200)
      ).body;
      const profile = await prisma.studentProfile.findFirstOrThrow({
        where: { user: { email: 'aluno1@nivela.test' } },
      });
      expect(stats.coins_balance).toBe(profile.coinsBalance);
      expect(stats.current_streak).toBe(14);
    });
  });

  describe('segunda execução', () => {
    it('não grava nada e avisa', async () => {
      await addAdmin();
      const first = await seedDemo(prisma, { now: TEST_NOW });
      expect(first.created).toBe(true);
      const before = await snapshot();
      const balances = await prisma.studentProfile.findMany({
        orderBy: { userId: 'asc' },
      });

      const second = await seedDemo(prisma, { now: TEST_NOW });
      expect(second.created).toBe(false);
      expect(second.message).toBe(
        'Os dados de demonstração já estão no banco.',
      );
      expect(await snapshot()).toEqual(before);
      expect(
        await prisma.studentProfile.findMany({ orderBy: { userId: 'asc' } }),
      ).toEqual(balances);
    });

    it('não altera nem apaga o administrador nem os dados já existentes do professor', async () => {
      const admin = await addAdmin();
      const own = await createUser(prisma, {
        role: Role.Teacher,
        email: 'outro.professor@nivela.test',
      });
      const adminBefore = await prisma.user.findUniqueOrThrow({
        where: { id: admin.id },
      });
      await seedDemo(prisma, { now: TEST_NOW });
      await seedDemo(prisma, { now: TEST_NOW });
      expect(
        await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }),
      ).toEqual(adminBefore);
      expect(
        await prisma.user.findUnique({ where: { id: own.id } }),
      ).not.toBeNull();
    });
  });

  describe('banco com dados existentes', () => {
    it('reaproveita disciplina e categoria de mesmo nome, sem duplicar', async () => {
      await addAdmin();
      const subject = await prisma.subject.create({
        data: { name: 'matemática', color: 'sky', icon: 'flask' },
      });
      const category = await prisma.category.create({
        data: { subjectId: subject.id, name: 'FRAÇÕES' },
      });

      const result = await seedDemo(prisma, { now: TEST_NOW });
      expect(result.created).toBe(true);

      const subjects = await prisma.subject.findMany({
        orderBy: { id: 'asc' },
      });
      expect(subjects.map((s) => s.name)).toEqual(['matemática', 'Português']);
      // A disciplina existente não é alterada.
      expect(subjects[0]).toEqual(subject);
      const math = await prisma.category.findMany({
        where: { subjectId: subject.id },
      });
      expect(math).toHaveLength(3);
      expect(math.filter((c) => c.id === category.id)).toHaveLength(1);
      expect(await prisma.category.count()).toBe(6);
      expect(await prisma.question.count()).toBe(24);
      expect(
        await prisma.question.count({ where: { subjectId: subject.id } }),
      ).toBe(12);
      expect(
        await prisma.question.count({ where: { categoryId: category.id } }),
      ).toBe(4);

      for (const profile of await prisma.studentProfile.findMany()) {
        const { _sum } = await prisma.coinTransaction.aggregate({
          where: { studentId: profile.userId },
          _sum: { amount: true },
        });
        expect(profile.coinsBalance).toBe(_sum.amount ?? 0);
        expect(profile.coinsBalance).toBeGreaterThanOrEqual(0);
      }
      const rejected = await prisma.rewardRedemption.findMany({
        where: { status: 'rejected' },
      });
      expect(rejected.length).toBeGreaterThanOrEqual(1);
      for (const redemption of rejected) {
        expect(
          await prisma.coinTransaction.count({
            where: { reason: 'refund', sourceId: redemption.id },
          }),
        ).toBe(1);
      }
      expect(await prisma.reward.count({ where: { stock: { lt: 0 } } })).toBe(
        0,
      );
    });

    it('recusa, sem gravar nada, quando um código de turma já existe', async () => {
      await addAdmin();
      const teacher = await createUser(prisma, { role: Role.Teacher });
      await prisma.classroom.create({
        data: {
          teacherId: teacher.id,
          name: 'Turma antiga',
          joinCode: 'NIV-1SER',
        },
      });
      const before = await snapshot();
      await expect(seedDemo(prisma, { now: TEST_NOW })).rejects.toThrow(
        'Não dá para criar os dados de demonstração: já existem no banco o código de turma NIV-1SER.',
      );
      expect(await snapshot()).toEqual(before);
    });

    it('recusa, sem gravar nada, nomeando o código e o e-mail em conflito', async () => {
      await addAdmin();
      const teacher = await createUser(prisma, { role: Role.Teacher });
      await prisma.classroom.create({
        data: {
          teacherId: teacher.id,
          name: 'Turma antiga',
          joinCode: 'NIV-9ANO',
        },
      });
      await createUser(prisma, { email: 'aluno3@nivela.test' });
      const before = await snapshot();
      await expect(seedDemo(prisma, { now: TEST_NOW })).rejects.toThrow(
        'Não dá para criar os dados de demonstração: já existem no banco o código de turma NIV-9ANO e o e-mail aluno3@nivela.test.',
      );
      expect(await snapshot()).toEqual(before);
      expect(
        await prisma.user.findUnique({
          where: { email: 'ana.lima@nivela.test' },
        }),
      ).toBeNull();
    });
  });
});
