import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createClassroom,
  createUser,
  DEFAULT_PASSWORD,
} from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';
import { TEST_NOW } from './helpers/test-clock';

const NOT_FOUND = 'Aluno não encontrado.';

describe('Alunos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function session(role: Role) {
    const user = await createUser(prisma, { role });
    const { body } = await http()
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: DEFAULT_PASSWORD,
        channel: role === Role.Student ? 'mobile' : 'web',
      })
      .expect(200);
    return { token: body.token as string, id: user.id };
  }

  const enroll = (classroomId: number, studentId: number) =>
    prisma.classroomStudent.create({ data: { classroomId, studentId } });

  let admin: Awaited<ReturnType<typeof session>>;
  let teacherA: Awaited<ReturnType<typeof session>>;
  let teacherB: Awaited<ReturnType<typeof session>>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await session(Role.Admin);
    teacherA = await session(Role.Teacher);
    teacherB = await session(Role.Teacher);
  });

  afterAll(async () => {
    await app.close();
  });

  it('professor lista só alunos matriculados nas suas turmas, por nome', async () => {
    const turmaA = await createClassroom(prisma, {
      teacherId: teacherA.id,
      name: 'Turma A',
    });
    const turmaB = await createClassroom(prisma, {
      teacherId: teacherB.id,
      name: 'Turma B',
    });
    const zeca = await createUser(prisma, { name: 'Zeca' });
    const ana = await createUser(prisma, { name: 'Ana' });
    const bruno = await createUser(prisma, { name: 'Bruno' });
    await createUser(prisma, { name: 'Sem turma' });
    await enroll(turmaA.id, zeca.id);
    await enroll(turmaA.id, ana.id);
    await enroll(turmaB.id, bruno.id);
    await prisma.studentProfile.update({
      where: { userId: ana.id },
      data: { coinsBalance: 40 },
    });

    const { body } = await http()
      .get('/api/v1/students')
      .set(as(teacherA.token))
      .expect(200);

    expect(body.data).toEqual([
      {
        id: ana.id,
        name: 'Ana',
        email: ana.email,
        active: true,
        classrooms: [{ id: turmaA.id, name: 'Turma A' }],
        coins_balance: 40,
        created_at: expect.any(String),
      },
      expect.objectContaining({ id: zeca.id, name: 'Zeca', coins_balance: 0 }),
    ]);
    expect(body.meta).toEqual({
      page: 1,
      per_page: 15,
      total: 2,
      last_page: 1,
    });
    expect(JSON.stringify(body)).not.toContain('Bruno');
    expect(JSON.stringify(body)).not.toContain('Turma B');
  });

  it('não vaza turmas de outros professores na lista de um aluno compartilhado', async () => {
    const turmaA = await createClassroom(prisma, {
      teacherId: teacherA.id,
      name: 'Turma A',
    });
    const turmaB = await createClassroom(prisma, {
      teacherId: teacherB.id,
      name: 'Turma B',
    });
    const shared = await createUser(prisma, { name: 'Compartilhado' });
    await enroll(turmaA.id, shared.id);
    await enroll(turmaB.id, shared.id);

    const list = await http()
      .get('/api/v1/students')
      .set(as(teacherA.token))
      .expect(200);
    expect(list.body.data[0].classrooms).toEqual([
      { id: turmaA.id, name: 'Turma A' },
    ]);

    const detail = await http()
      .get(`/api/v1/students/${shared.id}`)
      .set(as(teacherA.token))
      .expect(200);
    expect(detail.body.classrooms).toEqual([
      { id: turmaA.id, name: 'Turma A' },
    ]);

    const asAdmin = await http()
      .get(`/api/v1/students/${shared.id}`)
      .set(as(admin.token))
      .expect(200);
    expect(asAdmin.body.classrooms).toEqual([
      { id: turmaA.id, name: 'Turma A' },
      { id: turmaB.id, name: 'Turma B' },
    ]);
  });

  it('admin lista todos os alunos, inclusive os sem turma', async () => {
    const turmaA = await createClassroom(prisma, { teacherId: teacherA.id });
    const enrolled = await createUser(prisma, { name: 'Com turma' });
    await createUser(prisma, { name: 'Sem turma' });
    await enroll(turmaA.id, enrolled.id);
    // Professores e administradores não são alunos.
    const { body } = await http()
      .get('/api/v1/students')
      .set(as(admin.token))
      .expect(200);

    expect(body.data.map((s: { name: string }) => s.name)).toEqual([
      'Com turma',
      'Sem turma',
    ]);
  });

  it('busca por nome ou e-mail e filtra por turma', async () => {
    const turma1 = await createClassroom(prisma, { teacherId: teacherA.id });
    const turma2 = await createClassroom(prisma, { teacherId: teacherA.id });
    const maria = await createUser(prisma, {
      name: 'Maria',
      email: 'maria@escola.test',
    });
    const joao = await createUser(prisma, {
      name: 'João_Silva',
      email: 'joao@escola.test',
    });
    await enroll(turma1.id, maria.id);
    await enroll(turma2.id, joao.id);
    await enroll(turma2.id, maria.id);

    const byName = await http()
      .get('/api/v1/students?search=MARI')
      .set(as(teacherA.token))
      .expect(200);
    expect(byName.body.data.map((s: { id: number }) => s.id)).toEqual([
      maria.id,
    ]);

    const byEmail = await http()
      .get('/api/v1/students?search=joao@')
      .set(as(teacherA.token))
      .expect(200);
    expect(byEmail.body.data.map((s: { id: number }) => s.id)).toEqual([
      joao.id,
    ]);

    // "_" vale como texto, não como curinga.
    const wildcard = await http()
      .get('/api/v1/students?search=o_S')
      .set(as(teacherA.token))
      .expect(200);
    expect(wildcard.body.data).toHaveLength(1);
    const noWildcard = await http()
      .get('/api/v1/students?search=%25')
      .set(as(teacherA.token))
      .expect(200);
    expect(noWildcard.body.data).toEqual([]);

    const byClassroom = await http()
      .get(`/api/v1/students?classroom_id=${turma1.id}`)
      .set(as(teacherA.token))
      .expect(200);
    expect(byClassroom.body.data.map((s: { id: number }) => s.id)).toEqual([
      maria.id,
    ]);
    // O filtro por turma não mostra as outras turmas do aluno como filtro.
    expect(byClassroom.body.meta.total).toBe(1);

    await http()
      .get('/api/v1/students?classroom_id=abc')
      .set(as(teacherA.token))
      .expect(422);
  });

  it('filtrar pela turma de outro professor não mostra ninguém', async () => {
    const turmaA = await createClassroom(prisma, { teacherId: teacherA.id });
    const turmaB = await createClassroom(prisma, { teacherId: teacherB.id });
    const shared = await createUser(prisma);
    await enroll(turmaA.id, shared.id);
    await enroll(turmaB.id, shared.id);

    const { body } = await http()
      .get(`/api/v1/students?classroom_id=${turmaB.id}`)
      .set(as(teacherA.token))
      .expect(200);

    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('pagina a lista', async () => {
    const turma = await createClassroom(prisma, { teacherId: teacherA.id });
    for (let i = 1; i <= 3; i += 1) {
      const student = await createUser(prisma, { name: `Aluno ${i}` });
      await enroll(turma.id, student.id);
    }

    const { body } = await http()
      .get('/api/v1/students?per_page=2&page=2')
      .set(as(teacherA.token))
      .expect(200);

    expect(body.data.map((s: { name: string }) => s.name)).toEqual(['Aluno 3']);
    expect(body.meta).toEqual({
      page: 2,
      per_page: 2,
      total: 3,
      last_page: 2,
    });
  });

  it('ficha do aluno com sequências e moedas', async () => {
    const turma = await createClassroom(prisma, { teacherId: teacherA.id });
    const student = await createUser(prisma, { name: 'Ana' });
    await enroll(turma.id, student.id);
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: {
        coinsBalance: 15,
        currentStreak: 3,
        bestStreak: 7,
        // Estudou ontem (no relógio fixo dos e2e): a sequência continua valendo.
        lastStudyDate: new Date('2026-11-09T00:00:00Z'),
      },
    });

    const { body } = await http()
      .get(`/api/v1/students/${student.id}`)
      .set(as(teacherA.token))
      .expect(200);

    expect(body).toEqual({
      id: student.id,
      name: 'Ana',
      email: student.email,
      active: true,
      classrooms: [{ id: turma.id, name: turma.name }],
      coins_balance: 15,
      current_streak: 3,
      best_streak: 7,
      created_at: expect.any(String),
    });
    expect(body).not.toHaveProperty('password');
  });

  it('Ruling 10: ficha com último estudo há 3 dias mostra sequência 0 e preserva a melhor', async () => {
    const turma = await createClassroom(prisma, { teacherId: teacherA.id });
    const student = await createUser(prisma, { name: 'Ana' });
    await enroll(turma.id, student.id);
    const threeDaysAgo = new Date(TEST_NOW.getTime() - 3 * 86_400_000);
    await prisma.studentProfile.update({
      where: { userId: student.id },
      data: {
        currentStreak: 5,
        bestStreak: 8,
        lastStudyDate: new Date(
          `${threeDaysAgo.toISOString().slice(0, 10)}T00:00:00Z`,
        ),
      },
    });
    const { body } = await http()
      .get(`/api/v1/students/${student.id}`)
      .set(as(teacherA.token))
      .expect(200);
    expect(body).toMatchObject({ current_streak: 0, best_streak: 8 });
  });

  describe('visibilidade entre professores (RN15)', () => {
    it('aluno só da turma de A → 404 para B, idêntico a um id inexistente', async () => {
      const turmaA = await createClassroom(prisma, { teacherId: teacherA.id });
      const student = await createUser(prisma);
      await enroll(turmaA.id, student.id);

      const foreign = await http()
        .get(`/api/v1/students/${student.id}`)
        .set(as(teacherB.token))
        .expect(404);
      const missing = await http()
        .get('/api/v1/students/99999')
        .set(as(teacherB.token))
        .expect(404);

      expect(foreign.body).toEqual(missing.body);
      expect(foreign.body.message).toBe(NOT_FOUND);
      expect(JSON.stringify(foreign.body)).not.toContain(student.email);
    });

    it('aluno sem turma não é visível para professor, mas é para admin', async () => {
      const orphan = await createUser(prisma);

      await http()
        .get(`/api/v1/students/${orphan.id}`)
        .set(as(teacherA.token))
        .expect(404);
      await http()
        .get(`/api/v1/students/${orphan.id}`)
        .set(as(admin.token))
        .expect(200);
    });

    it('professor e admin não são alunos: ids deles → 404', async () => {
      await http()
        .get(`/api/v1/students/${teacherB.id}`)
        .set(as(admin.token))
        .expect(404);
      await http()
        .get(`/api/v1/students/${admin.id}`)
        .set(as(admin.token))
        .expect(404);
    });

    it('id inválido → 404 "Aluno não encontrado."', async () => {
      await http()
        .get('/api/v1/students/abc')
        .set(as(teacherA.token))
        .expect(404)
        .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));
    });
  });

  it('aluno não acessa as rotas de alunos (403) e anônimo recebe 401', async () => {
    const student = await session(Role.Student);

    await http().get('/api/v1/students').set(as(student.token)).expect(403);
    await http()
      .get(`/api/v1/students/${student.id}`)
      .set(as(student.token))
      .expect(403);
    await http().get('/api/v1/students').expect(401);
  });
});
