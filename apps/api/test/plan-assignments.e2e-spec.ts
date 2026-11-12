import { INestApplication } from '@nestjs/common';
import type { ApiPlanAssignment } from '@nivela/api-contract';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createCategory,
  createClassroom,
  createQuestion,
  createSubject,
  createUser,
  DEFAULT_PASSWORD,
} from './helpers/factories';
import { resetDatabase } from './helpers/reset-database';

const NOT_FOUND = 'Plano não encontrado.';

describe('Atribuição de planos (e2e)', () => {
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

  let admin: Awaited<ReturnType<typeof session>>;
  let teacherA: Awaited<ReturnType<typeof session>>;
  let teacherB: Awaited<ReturnType<typeof session>>;
  let subjectId: number;

  /** Plano completo (1 capítulo, 1 questão) do professor; publicado ou não. */
  async function plan(token: string, publish: boolean): Promise<number> {
    const category = await createCategory(prisma, { subjectId });
    const question = await createQuestion(prisma, {
      subjectId,
      categoryId: category.id,
    });
    const { body } = await http()
      .post('/api/v1/plans')
      .set(as(token))
      .send({ title: 'Plano de frações', subject_id: subjectId })
      .expect(201);
    const withChapter = await http()
      .post(`/api/v1/plans/${body.id}/chapters`)
      .set(as(token))
      .send({ title: 'Capítulo 1' })
      .expect(201);
    await http()
      .put(
        `/api/v1/plans/${body.id}/chapters/${withChapter.body.chapters[0].id}/questions`,
      )
      .set(as(token))
      .send({ question_ids: [question.id] })
      .expect(200);
    if (publish) {
      await http()
        .post(`/api/v1/plans/${body.id}/publish`)
        .set(as(token))
        .expect(200);
    }
    return body.id as number;
  }

  const assign = (
    token: string,
    planId: number,
    payload: Record<string, unknown>,
  ) =>
    http()
      .post(`/api/v1/plans/${planId}/assignments`)
      .set(as(token))
      .send(payload);

  /** Aluno matriculado em uma turma do professor. */
  async function enrolled(teacherId: number) {
    const classroom = await createClassroom(prisma, { teacherId });
    const student = await createUser(prisma, { name: 'Aluno Matriculado' });
    await prisma.classroomStudent.create({
      data: { classroomId: classroom.id, studentId: student.id },
    });
    return { classroom, student };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await session(Role.Admin);
    teacherA = await session(Role.Teacher);
    teacherB = await session(Role.Teacher);
    subjectId = (await createSubject(prisma)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('plano em rascunho não pode ser atribuído (409)', async () => {
    const planId = await plan(teacherA.token, false);
    const { classroom } = await enrolled(teacherA.id);
    const { body } = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(409);
    expect(body.message).toBe('Publique o plano antes de atribuir.');
    expect(await prisma.planAssignment.count()).toBe(0);
  });

  it('atribui a uma turma e a um aluno, com prazo opcional, e lista', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom, student } = await enrolled(teacherA.id);

    const toClassroom = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
      due_date: '2099-12-31',
    }).expect(201);
    expect(toClassroom.body).toMatchObject({
      target: { type: 'classroom', id: classroom.id, name: classroom.name },
      due_date: '2099-12-31',
    });
    const toStudent = await assign(teacherA.token, planId, {
      student_id: student.id,
      due_date: null,
    }).expect(201);
    expect(toStudent.body).toMatchObject({
      target: { type: 'student', id: student.id, name: student.name },
      due_date: null,
    });

    const { body } = await http()
      .get(`/api/v1/plans/${planId}/assignments`)
      .set(as(teacherA.token))
      .expect(200);
    expect(
      (body.data as ApiPlanAssignment[]).map((a) => a.target.type),
    ).toEqual(['classroom', 'student']);
    const summary = await http()
      .get(`/api/v1/plans/${planId}`)
      .set(as(teacherA.token))
      .expect(200);
    expect(summary.body.assignments_count).toBe(2);
  });

  it('exige exatamente um alvo e valida o prazo', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom, student } = await enrolled(teacherA.id);
    const none = await assign(teacherA.token, planId, {}).expect(422);
    expect(none.body.errors).toHaveProperty('classroom_id');
    const both = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
      student_id: student.id,
    }).expect(422);
    expect(both.body.errors).toHaveProperty('student_id');
    const past = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
      due_date: '2020-01-01',
    }).expect(422);
    expect(past.body.errors.due_date).toEqual([
      'A data limite não pode ser no passado.',
    ]);
    for (const due_date of ['31/12/2099', '2099-02-31', 'amanhã']) {
      const { body } = await assign(teacherA.token, planId, {
        classroom_id: classroom.id,
        due_date,
      }).expect(422);
      expect(body.errors).toHaveProperty('due_date');
    }
    expect(await prisma.planAssignment.count()).toBe(0);
  });

  it('turma ou aluno de outro professor: 422 no campo (RN15)', async () => {
    const planId = await plan(teacherA.token, true);
    const other = await enrolled(teacherB.id);
    const toClassroom = await assign(teacherA.token, planId, {
      classroom_id: other.classroom.id,
    }).expect(422);
    expect(toClassroom.body.errors.classroom_id).toEqual([
      'Turma não encontrada.',
    ]);
    const toStudent = await assign(teacherA.token, planId, {
      student_id: other.student.id,
    }).expect(422);
    expect(toStudent.body.errors.student_id).toEqual(['Aluno não encontrado.']);
    const missing = await assign(teacherA.token, planId, {
      classroom_id: 999999,
    }).expect(422);
    expect(missing.body.errors).toHaveProperty('classroom_id');
    // Aluno sem turma só o administrador enxerga.
    const loose = await createUser(prisma);
    await assign(teacherA.token, planId, { student_id: loose.id }).expect(422);
    await assign(admin.token, await plan(admin.token, true), {
      student_id: loose.id,
    }).expect(201);
    expect(await prisma.planAssignment.count()).toBe(1);
  });

  it('atribuição duplicada responde 422, inclusive em pedidos simultâneos', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom, student } = await enrolled(teacherA.id);
    await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(201);
    const classroomDup = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(422);
    expect(classroomDup.body.errors.classroom_id).toEqual([
      'Este plano já foi atribuído a esta turma.',
    ]);
    const results = await Promise.all([
      assign(teacherA.token, planId, { student_id: student.id }),
      assign(teacherA.token, planId, { student_id: student.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    const loser = results.find((r) => r.status === 422);
    expect(loser?.body.errors.student_id).toEqual([
      'Este plano já foi atribuído a este aluno.',
    ]);
    expect(await prisma.planAssignment.count()).toBe(2);
  });

  it('o mesmo aluno pode receber o plano direto e pela turma; outro plano é independente', async () => {
    const planId = await plan(teacherA.token, true);
    const otherPlan = await plan(teacherA.token, true);
    const { classroom, student } = await enrolled(teacherA.id);
    await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(201);
    await assign(teacherA.token, planId, { student_id: student.id }).expect(
      201,
    );
    await assign(teacherA.token, otherPlan, {
      classroom_id: classroom.id,
    }).expect(201);
  });

  it('remove a atribuição; id de outro plano ou inexistente responde 404', async () => {
    const planId = await plan(teacherA.token, true);
    const otherPlan = await plan(teacherA.token, true);
    const { classroom } = await enrolled(teacherA.id);
    const created = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(201);
    const wrongPlan = await http()
      .delete(`/api/v1/plans/${otherPlan}/assignments/${created.body.id}`)
      .set(as(teacherA.token))
      .expect(404);
    expect(wrongPlan.body.message).toBe('Atribuição não encontrada.');
    await http()
      .delete(`/api/v1/plans/${planId}/assignments/999999`)
      .set(as(teacherA.token))
      .expect(404);
    await http()
      .delete(`/api/v1/plans/${planId}/assignments/${created.body.id}`)
      .set(as(teacherA.token))
      .expect(204);
    expect(await prisma.planAssignment.count()).toBe(0);
  });

  it('professor B não lista, atribui nem remove atribuições do plano do A (404)', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom } = await enrolled(teacherA.id);
    const created = await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(201);
    const bearer = as(teacherB.token);
    const attempts = [
      http().get(`/api/v1/plans/${planId}/assignments`).set(bearer),
      assign(teacherB.token, planId, { classroom_id: classroom.id }),
      http()
        .delete(`/api/v1/plans/${planId}/assignments/${created.body.id}`)
        .set(bearer),
    ];
    for (const pending of attempts) {
      const { status, body } = await pending;
      expect(status).toBe(404);
      expect(body.message).toBe(NOT_FOUND);
    }
    expect(await prisma.planAssignment.count()).toBe(1);
    await http()
      .get(`/api/v1/plans/${planId}/assignments`)
      .set(as(admin.token))
      .expect(200);
  });

  it('RN15: professor não remove atribuição que o administrador fez fora das turmas dele (404); o administrador remove', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom: foreignClassroom, student: foreign } = await enrolled(
      teacherB.id,
    );
    const loose = await createUser(prisma, { name: 'Sem turma' });
    const created = [
      await assign(admin.token, planId, {
        classroom_id: foreignClassroom.id,
      }).expect(201),
      await assign(admin.token, planId, { student_id: foreign.id }).expect(201),
      await assign(admin.token, planId, { student_id: loose.id }).expect(201),
    ].map((response) => response.body.id as number);
    for (const id of created) {
      const { body } = await http()
        .delete(`/api/v1/plans/${planId}/assignments/${id}`)
        .set(as(teacherA.token))
        .expect(404);
      expect(body.message).toBe('Atribuição não encontrada.');
    }
    expect(await prisma.planAssignment.count()).toBe(3);
    for (const id of created) {
      await http()
        .delete(`/api/v1/plans/${planId}/assignments/${id}`)
        .set(as(admin.token))
        .expect(204);
    }
    expect(await prisma.planAssignment.count()).toBe(0);
  });

  it('aluno recebe 403 nas rotas de atribuição', async () => {
    const planId = await plan(teacherA.token, true);
    const student = await session(Role.Student);
    await http()
      .get(`/api/v1/plans/${planId}/assignments`)
      .set(as(student.token))
      .expect(403);
    await assign(student.token, planId, { student_id: 1 }).expect(403);
  });

  it('o banco recusa atribuição sem alvo ou com os dois, e duplicada', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom, student } = await enrolled(teacherA.id);
    await expect(
      prisma.planAssignment.create({ data: { levelingPlanId: planId } }),
    ).rejects.toThrow();
    await expect(
      prisma.planAssignment.create({
        data: {
          levelingPlanId: planId,
          classroomId: classroom.id,
          studentId: student.id,
        },
      }),
    ).rejects.toThrow();
    await prisma.planAssignment.create({
      data: { levelingPlanId: planId, classroomId: classroom.id },
    });
    await expect(
      prisma.planAssignment.create({
        data: { levelingPlanId: planId, classroomId: classroom.id },
      }),
    ).rejects.toThrow();
  });

  it('excluir plano publicado com atribuição continua 409 e apagar a turma remove a atribuição', async () => {
    const planId = await plan(teacherA.token, true);
    const { classroom } = await enrolled(teacherA.id);
    await assign(teacherA.token, planId, {
      classroom_id: classroom.id,
    }).expect(201);
    await http()
      .delete(`/api/v1/plans/${planId}`)
      .set(as(teacherA.token))
      .expect(409);
    await prisma.classroom.delete({ where: { id: classroom.id } });
    expect(await prisma.planAssignment.count()).toBe(0);
  });
});
