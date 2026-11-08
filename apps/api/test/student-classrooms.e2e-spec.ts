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

describe('Turmas do aluno (e2e)', () => {
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

  let student: Awaited<ReturnType<typeof session>>;
  let teacher: { id: number; name: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    student = await session(Role.Student);
    teacher = await createUser(prisma, {
      role: Role.Teacher,
      name: 'Profa. Ana',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista as turmas em que o aluno está, por nome', async () => {
    const beta = await createClassroom(prisma, {
      teacherId: teacher.id,
      name: 'Beta',
    });
    const alfa = await createClassroom(prisma, {
      teacherId: teacher.id,
      name: 'Alfa',
      active: false,
    });
    await createClassroom(prisma, { teacherId: teacher.id, name: 'Outra' });
    await prisma.classroomStudent.createMany({
      data: [
        { classroomId: beta.id, studentId: student.id },
        { classroomId: alfa.id, studentId: student.id },
      ],
    });

    const { body } = await http()
      .get('/api/v1/me/classrooms')
      .set(as(student.token))
      .expect(200);

    expect(body).toEqual({
      data: [
        {
          id: alfa.id,
          name: 'Alfa',
          school_year: '9º ano',
          teacher: { name: 'Profa. Ana' },
          joined_at: expect.any(String),
        },
        expect.objectContaining({ id: beta.id, name: 'Beta' }),
      ],
    });
    // Não expõe o código nem o id do professor.
    expect(JSON.stringify(body)).not.toContain('join_code');
    expect(body.data[0].teacher).not.toHaveProperty('id');
  });

  it('aluno sem turma recebe lista vazia e só vê as próprias turmas', async () => {
    const other = await createUser(prisma);
    const classroom = await createClassroom(prisma, { teacherId: teacher.id });
    await prisma.classroomStudent.create({
      data: { classroomId: classroom.id, studentId: other.id },
    });

    const { body } = await http()
      .get('/api/v1/me/classrooms')
      .set(as(student.token))
      .expect(200);

    expect(body).toEqual({ data: [] });
  });

  it('entra em uma turma pelo código (aceita espaços e minúsculas)', async () => {
    const classroom = await createClassroom(prisma, {
      teacherId: teacher.id,
      name: 'Turma 7',
      joinCode: 'NIV-4K7Q',
    });

    const { body } = await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({ join_code: ' niv 4k7q ' })
      .expect(201);

    expect(body).toEqual({
      id: classroom.id,
      name: 'Turma 7',
      school_year: '9º ano',
      teacher: { name: 'Profa. Ana' },
      joined_at: expect.any(String),
    });
    const link = await prisma.classroomStudent.findMany();
    expect(link).toHaveLength(1);
    expect(link[0]).toMatchObject({
      classroomId: classroom.id,
      studentId: student.id,
    });

    const list = await http()
      .get('/api/v1/me/classrooms')
      .set(as(student.token))
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('entrar de novo na mesma turma → 422 "Você já está nesta turma."', async () => {
    await createClassroom(prisma, {
      teacherId: teacher.id,
      joinCode: 'NIV-4K7Q',
    });
    await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({ join_code: 'NIV-4K7Q' })
      .expect(201);

    const { body } = await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({ join_code: 'niv-4k7q' })
      .expect(422);

    expect(body.errors).toEqual({ join_code: ['Você já está nesta turma.'] });
    expect(await prisma.classroomStudent.count()).toBe(1);
  });

  it('pedidos simultâneos com o mesmo código: um entra, o outro recebe 422', async () => {
    await createClassroom(prisma, {
      teacherId: teacher.id,
      joinCode: 'NIV-4K7Q',
    });
    const join = () =>
      http()
        .post('/api/v1/me/classrooms')
        .set(as(student.token))
        .send({ join_code: 'NIV-4K7Q' });

    const results = await Promise.all([join(), join(), join()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 422, 422]);
    for (const result of results.filter((r) => r.status === 422)) {
      expect(result.body.errors).toEqual({
        join_code: ['Você já está nesta turma.'],
      });
    }
    expect(await prisma.classroomStudent.count()).toBe(1);
  });

  it('código inexistente ou turma inativa → 422 no campo join_code', async () => {
    await createClassroom(prisma, {
      teacherId: teacher.id,
      joinCode: 'NIV-OFF2',
      active: false,
    });

    const unknown = await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({ join_code: 'NIV-ZZZZ' })
      .expect(422);
    expect(unknown.body.errors).toEqual({
      join_code: ['Código de turma inválido.'],
    });

    const inactive = await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({ join_code: 'NIV-OFF2' })
      .expect(422);
    expect(inactive.body.errors).toEqual({
      join_code: ['Esta turma não está aceitando novos alunos.'],
    });
    expect(await prisma.classroomStudent.count()).toBe(0);
  });

  it('código ausente → 422 "Informe o código da turma."', async () => {
    const { body } = await http()
      .post('/api/v1/me/classrooms')
      .set(as(student.token))
      .send({})
      .expect(422);

    expect(body.errors.join_code).toContain('Informe o código da turma.');
  });

  it('professor e administrador não usam as rotas do aluno (403); anônimo recebe 401', async () => {
    const teacherSession = await session(Role.Teacher);
    const adminSession = await session(Role.Admin);

    for (const { token } of [teacherSession, adminSession]) {
      await http().get('/api/v1/me/classrooms').set(as(token)).expect(403);
      await http()
        .post('/api/v1/me/classrooms')
        .set(as(token))
        .send({ join_code: 'NIV-4K7Q' })
        .expect(403);
    }
    await http().get('/api/v1/me/classrooms').expect(401);
    await http().post('/api/v1/me/classrooms').send({}).expect(401);
  });
});
