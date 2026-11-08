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

const NOT_FOUND = 'Turma não encontrada.';

describe('Turmas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** Cria o usuário com o perfil e abre uma sessão; devolve token e id. */
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
    return { token: body.token as string, id: user.id, name: user.name };
  }

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

  it('professor cria turma com código NIV-XXXX único e vira o dono', async () => {
    const { body } = await http()
      .post('/api/v1/classrooms')
      .set(as(teacherA.token))
      .send({ name: '  9º A  ', school_year: '9º ano' })
      .expect(201);

    expect(body).toEqual({
      id: expect.any(Number),
      name: '9º A',
      school_year: '9º ano',
      join_code: expect.stringMatching(/^NIV-[A-Z0-9]{4}$/),
      active: true,
      students_count: 0,
      teacher: { id: teacherA.id, name: teacherA.name },
      created_at: expect.any(String),
      students: [],
    });

    const other = await http()
      .post('/api/v1/classrooms')
      .set(as(teacherA.token))
      .send({ name: '9º B' })
      .expect(201);
    expect(other.body.join_code).not.toBe(body.join_code);
    expect(other.body.school_year).toBeNull();
  });

  it('professor não escolhe o dono: teacher_id enviado é ignorado', async () => {
    const { body } = await http()
      .post('/api/v1/classrooms')
      .set(as(teacherA.token))
      .send({ name: '9º A', teacher_id: teacherB.id })
      .expect(201);

    expect(body.teacher.id).toBe(teacherA.id);
  });

  it('admin cria turma informando o professor', async () => {
    const { body } = await http()
      .post('/api/v1/classrooms')
      .set(as(admin.token))
      .send({ name: '7º C', teacher_id: teacherB.id })
      .expect(201);

    expect(body.teacher).toEqual({ id: teacherB.id, name: teacherB.name });
  });

  it('admin sem teacher_id ou com professor inexistente → 422', async () => {
    const missing = await http()
      .post('/api/v1/classrooms')
      .set(as(admin.token))
      .send({ name: '7º C' })
      .expect(422);
    expect(missing.body.errors).toEqual({
      teacher_id: ['Informe o professor da turma.'],
    });

    const unknown = await http()
      .post('/api/v1/classrooms')
      .set(as(admin.token))
      .send({ name: '7º C', teacher_id: 99999 })
      .expect(422);
    expect(unknown.body.errors).toEqual({
      teacher_id: ['Professor não encontrado.'],
    });

    // Um administrador (ou aluno) não é professor.
    const notTeacher = await http()
      .post('/api/v1/classrooms')
      .set(as(admin.token))
      .send({ name: '7º C', teacher_id: admin.id })
      .expect(422);
    expect(notTeacher.body.errors.teacher_id).toEqual([
      'Professor não encontrado.',
    ]);
    expect(await prisma.classroom.count()).toBe(0);
  });

  it('admin não cria turma para professor inativo → 422', async () => {
    const inactive = await createUser(prisma, {
      role: Role.Teacher,
      active: false,
    });

    const { body } = await http()
      .post('/api/v1/classrooms')
      .set(as(admin.token))
      .send({ name: '7º C', teacher_id: inactive.id })
      .expect(422);

    expect(body.errors).toEqual({ teacher_id: ['Professor não encontrado.'] });
    expect(await prisma.classroom.count()).toBe(0);
  });

  it('valida nome e ano letivo', async () => {
    const { body } = await http()
      .post('/api/v1/classrooms')
      .set(as(teacherA.token))
      .send({ name: ' a ', school_year: 'x'.repeat(41) })
      .expect(422);

    expect(body.errors.name).toEqual([
      'O nome deve ter pelo menos 2 caracteres.',
    ]);
    expect(body.errors.school_year).toEqual([
      'O ano letivo deve ter no máximo 40 caracteres.',
    ]);

    const empty = await http()
      .post('/api/v1/classrooms')
      .set(as(teacherA.token))
      .send({})
      .expect(422);
    expect(empty.body.errors.name).toContain('Informe o nome da turma.');
  });

  it('lista só as turmas do professor, por nome, com busca e situação', async () => {
    const b = await createClassroom(prisma, {
      teacherId: teacherA.id,
      name: 'Beta',
    });
    await createClassroom(prisma, { teacherId: teacherA.id, name: 'Alfa' });
    await createClassroom(prisma, {
      teacherId: teacherA.id,
      name: 'Gama 50%',
      active: false,
    });
    await createClassroom(prisma, { teacherId: teacherB.id, name: 'Alfa B' });
    const student = await createUser(prisma);
    await prisma.classroomStudent.create({
      data: { classroomId: b.id, studentId: student.id },
    });

    const all = await http()
      .get('/api/v1/classrooms')
      .set(as(teacherA.token))
      .expect(200);
    expect(all.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Alfa',
      'Beta',
      'Gama 50%',
    ]);
    expect(
      all.body.data.find((c: { name: string }) => c.name === 'Beta')
        .students_count,
    ).toBe(1);
    expect(all.body.meta).toEqual({
      page: 1,
      per_page: 15,
      total: 3,
      last_page: 1,
    });

    const search = await http()
      .get('/api/v1/classrooms?search=ALF')
      .set(as(teacherA.token))
      .expect(200);
    expect(search.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Alfa',
    ]);

    // Curinga digitado vale como texto.
    const wildcard = await http()
      .get('/api/v1/classrooms?search=%25')
      .set(as(teacherA.token))
      .expect(200);
    expect(wildcard.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Gama 50%',
    ]);

    const inactive = await http()
      .get('/api/v1/classrooms?status=inactive')
      .set(as(teacherA.token))
      .expect(200);
    expect(inactive.body.data).toHaveLength(1);

    const paged = await http()
      .get('/api/v1/classrooms?per_page=2&page=2')
      .set(as(teacherA.token))
      .expect(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta.last_page).toBe(2);
  });

  it('admin lista as turmas de todos os professores', async () => {
    await createClassroom(prisma, { teacherId: teacherA.id });
    await createClassroom(prisma, { teacherId: teacherB.id });

    const { body } = await http()
      .get('/api/v1/classrooms')
      .set(as(admin.token))
      .expect(200);

    expect(body.meta.total).toBe(2);
  });

  describe('visibilidade entre professores (RN15)', () => {
    let classroomA: { id: number; joinCode: string };

    beforeEach(async () => {
      classroomA = await createClassroom(prisma, {
        teacherId: teacherA.id,
        joinCode: 'NIV-AAAA',
      });
    });

    it('professor B não vê a turma de A na lista', async () => {
      const { body } = await http()
        .get('/api/v1/classrooms')
        .set(as(teacherB.token))
        .expect(200);

      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it('GET /classrooms/:id de outro professor → 404, igual a um id inexistente', async () => {
      const foreign = await http()
        .get(`/api/v1/classrooms/${classroomA.id}`)
        .set(as(teacherB.token))
        .expect(404);
      const missing = await http()
        .get('/api/v1/classrooms/99999')
        .set(as(teacherB.token))
        .expect(404);

      expect(foreign.body).toEqual(missing.body);
      expect(foreign.body.message).toBe(NOT_FOUND);
      expect(JSON.stringify(foreign.body)).not.toContain('NIV-AAAA');
    });

    it('PUT, regenerar código, adicionar e remover aluno de outro professor → 404 sem alterar nada', async () => {
      const student = await createUser(prisma);
      await prisma.classroomStudent.create({
        data: { classroomId: classroomA.id, studentId: student.id },
      });
      const token = teacherB.token;

      await http()
        .put(`/api/v1/classrooms/${classroomA.id}`)
        .set(as(token))
        .send({ name: 'Invadida', active: false })
        .expect(404)
        .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));
      await http()
        .post(`/api/v1/classrooms/${classroomA.id}/join-code`)
        .set(as(token))
        .expect(404)
        .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));

      await http()
        .post(`/api/v1/classrooms/${classroomA.id}/students`)
        .set(as(token))
        .send({
          name: 'Intruso',
          email: 'intruso@aluno.test',
          password: 'segredo123',
        })
        .expect(404)
        .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));
      await http()
        .delete(`/api/v1/classrooms/${classroomA.id}/students/${student.id}`)
        .set(as(token))
        .expect(404)
        .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));

      const after = await prisma.classroom.findUniqueOrThrow({
        where: { id: classroomA.id },
      });
      expect(after.name).not.toBe('Invadida');
      expect(after.active).toBe(true);
      expect(after.joinCode).toBe('NIV-AAAA');
      expect(
        await prisma.user.count({ where: { email: 'intruso@aluno.test' } }),
      ).toBe(0);
      expect(
        await prisma.classroomStudent.count({
          where: { classroomId: classroomA.id },
        }),
      ).toBe(1);
    });

    it('admin enxerga a turma de qualquer professor', async () => {
      const { body } = await http()
        .get(`/api/v1/classrooms/${classroomA.id}`)
        .set(as(admin.token))
        .expect(200);

      expect(body.join_code).toBe('NIV-AAAA');
    });
  });

  it('GET /classrooms/:id traz os alunos matriculados por nome', async () => {
    const classroom = await createClassroom(prisma, { teacherId: teacherA.id });
    const zeca = await createUser(prisma, { name: 'Zeca' });
    const ana = await createUser(prisma, { name: 'Ana', active: false });
    await prisma.classroomStudent.createMany({
      data: [
        { classroomId: classroom.id, studentId: zeca.id },
        { classroomId: classroom.id, studentId: ana.id },
      ],
    });

    const { body } = await http()
      .get(`/api/v1/classrooms/${classroom.id}`)
      .set(as(teacherA.token))
      .expect(200);

    expect(body.students_count).toBe(2);
    expect(body.students).toEqual([
      {
        id: ana.id,
        name: 'Ana',
        email: ana.email,
        active: false,
        joined_at: expect.any(String),
      },
      {
        id: zeca.id,
        name: 'Zeca',
        email: zeca.email,
        active: true,
        joined_at: expect.any(String),
      },
    ]);
  });

  it('id que não é número → 404 "Turma não encontrada."', async () => {
    await http()
      .get('/api/v1/classrooms/abc')
      .set(as(teacherA.token))
      .expect(404)
      .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));
  });

  it('edita nome, ano letivo e situação (dono e admin)', async () => {
    const classroom = await createClassroom(prisma, { teacherId: teacherA.id });

    const { body } = await http()
      .put(`/api/v1/classrooms/${classroom.id}`)
      .set(as(teacherA.token))
      .send({ name: ' Nova ', school_year: null, active: false })
      .expect(200);
    expect(body).toMatchObject({
      id: classroom.id,
      name: 'Nova',
      school_year: null,
      active: false,
      join_code: classroom.joinCode,
    });

    const byAdmin = await http()
      .put(`/api/v1/classrooms/${classroom.id}`)
      .set(as(admin.token))
      .send({ name: 'Do admin', active: true })
      .expect(200);
    expect(byAdmin.body).toMatchObject({ name: 'Do admin', active: true });
    expect(byAdmin.body.teacher.id).toBe(teacherA.id);
  });

  it('regenerar o código troca o valor e o antigo deixa de funcionar no cadastro', async () => {
    const classroom = await createClassroom(prisma, {
      teacherId: teacherA.id,
      joinCode: 'NIV-4K7Q',
    });

    const { body } = await http()
      .post(`/api/v1/classrooms/${classroom.id}/join-code`)
      .set(as(teacherA.token))
      .expect(200);

    expect(body.join_code).toMatch(/^NIV-[A-Z0-9]{4}$/);
    expect(body.join_code).not.toBe('NIV-4K7Q');
    const stored = await prisma.classroom.findUniqueOrThrow({
      where: { id: classroom.id },
    });
    expect(stored.joinCode).toBe(body.join_code);

    const register = (code: string) =>
      http().post('/api/v1/auth/register-student').send({
        name: 'Bia',
        email: 'bia@aluno.test',
        password: 'segredo123',
        password_confirmation: 'segredo123',
        join_code: code,
      });
    const old = await register('NIV-4K7Q').expect(422);
    expect(old.body.errors.join_code).toEqual(['Código de turma inválido.']);
    await register(body.join_code as string).expect(201);
  });

  describe('alunos da turma', () => {
    const newStudent = {
      name: '  Bia Lima ',
      email: ' Bia@Aluno.test ',
      password: 'segredo123',
    };

    it('professor cria o aluno (usuário + perfil + matrícula) e ele já entra no app', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });

      const { body } = await http()
        .post(`/api/v1/classrooms/${classroom.id}/students`)
        .set(as(teacherA.token))
        .send(newStudent)
        .expect(201);

      expect(body).toEqual({
        id: expect.any(Number),
        name: 'Bia Lima',
        email: 'bia@aluno.test',
        active: true,
        classrooms: [{ id: classroom.id, name: classroom.name }],
        coins_balance: 0,
        current_streak: 0,
        best_streak: 0,
        created_at: expect.any(String),
      });
      expect(body).not.toHaveProperty('password');

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'bia@aluno.test' },
        include: { studentProfile: true, enrollments: true },
      });
      expect(user.role).toBe('student');
      expect(user.password).not.toBe('segredo123');
      expect(user.studentProfile).not.toBeNull();
      expect(user.enrollments.map((e) => e.classroomId)).toEqual([
        classroom.id,
      ]);

      await http()
        .post('/api/v1/auth/login')
        .send({
          email: 'bia@aluno.test',
          password: 'segredo123',
          channel: 'mobile',
        })
        .expect(200);

      const detail = await http()
        .get(`/api/v1/classrooms/${classroom.id}`)
        .set(as(teacherA.token))
        .expect(200);
      expect(detail.body.students_count).toBe(1);
      expect(detail.body.students[0]).toMatchObject({ id: body.id });
    });

    it('e-mail já cadastrado → 422 com a dica do código e nada é criado', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      await createUser(prisma, { email: 'bia@aluno.test' });

      const { body } = await http()
        .post(`/api/v1/classrooms/${classroom.id}/students`)
        .set(as(teacherA.token))
        .send(newStudent)
        .expect(422);

      expect(body.errors).toEqual({
        email: [
          'Este e-mail já está cadastrado. O aluno pode entrar na turma pelo código.',
        ],
      });
      expect(
        await prisma.classroomStudent.count({
          where: { classroomId: classroom.id },
        }),
      ).toBe(0);
    });

    it('valida nome, e-mail e senha', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });

      const { body } = await http()
        .post(`/api/v1/classrooms/${classroom.id}/students`)
        .set(as(teacherA.token))
        .send({ name: ' ', email: 'x', password: 'curta' })
        .expect(422);

      expect(Object.keys(body.errors).sort()).toEqual([
        'email',
        'name',
        'password',
      ]);
      expect(body.errors.password).toEqual([
        'A senha deve ter pelo menos 8 caracteres.',
      ]);
      expect(await prisma.user.count({ where: { role: 'student' } })).toBe(0);
    });

    it('admin cria aluno em turma de qualquer professor', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });

      await http()
        .post(`/api/v1/classrooms/${classroom.id}/students`)
        .set(as(admin.token))
        .send(newStudent)
        .expect(201);
    });

    it('remover desmatricula o aluno sem apagar a conta', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      const student = await createUser(prisma);
      await prisma.classroomStudent.create({
        data: { classroomId: classroom.id, studentId: student.id },
      });

      await http()
        .delete(`/api/v1/classrooms/${classroom.id}/students/${student.id}`)
        .set(as(teacherA.token))
        .expect(204);

      expect(await prisma.classroomStudent.count()).toBe(0);
      expect(await prisma.user.count({ where: { id: student.id } })).toBe(1);
      expect(await prisma.studentProfile.count()).toBe(1);
    });

    it('turma inativa não recebe aluno pela matrícula manual → 409 e nada é criado (RN13)', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
        active: false,
      });

      await http()
        .post(`/api/v1/classrooms/${classroom.id}/students`)
        .set(as(teacherA.token))
        .send({
          name: 'Bia',
          email: 'bia@aluno.test',
          password: 'segredo123',
        })
        .expect(409)
        .expect(({ body }) =>
          expect(body.message).toBe(
            'Esta turma não está aceitando novos alunos.',
          ),
        );

      expect(
        await prisma.user.count({ where: { email: 'bia@aluno.test' } }),
      ).toBe(0);
      expect(await prisma.classroomStudent.count()).toBe(0);
    });

    describe('aluno compartilhado entre professores', () => {
      it('B remove da turma de B e a matrícula na turma de A permanece; na turma de A → 404', async () => {
        const classroomA = await createClassroom(prisma, {
          teacherId: teacherA.id,
        });
        const classroomB = await createClassroom(prisma, {
          teacherId: teacherB.id,
        });
        const student = await createUser(prisma);
        await prisma.classroomStudent.createMany({
          data: [
            { classroomId: classroomA.id, studentId: student.id },
            { classroomId: classroomB.id, studentId: student.id },
          ],
        });

        await http()
          .delete(`/api/v1/classrooms/${classroomA.id}/students/${student.id}`)
          .set(as(teacherB.token))
          .expect(404)
          .expect(({ body }) => expect(body.message).toBe(NOT_FOUND));
        expect(await prisma.classroomStudent.count()).toBe(2);

        await http()
          .delete(`/api/v1/classrooms/${classroomB.id}/students/${student.id}`)
          .set(as(teacherB.token))
          .expect(204);

        const left = await prisma.classroomStudent.findMany();
        expect(left).toHaveLength(1);
        expect(left[0]).toMatchObject({
          classroomId: classroomA.id,
          studentId: student.id,
        });
      });

      it('admin lista os alunos de uma turma com classroom_id', async () => {
        const classroomA = await createClassroom(prisma, {
          teacherId: teacherA.id,
        });
        const classroomB = await createClassroom(prisma, {
          teacherId: teacherB.id,
        });
        const inA = await createUser(prisma);
        const inB = await createUser(prisma);
        await prisma.classroomStudent.createMany({
          data: [
            { classroomId: classroomA.id, studentId: inA.id },
            { classroomId: classroomB.id, studentId: inB.id },
          ],
        });

        const { body } = await http()
          .get(`/api/v1/students?classroom_id=${classroomB.id}`)
          .set(as(admin.token))
          .expect(200);

        expect(
          (body.data as { id: number }[]).map((student) => student.id),
        ).toEqual([inB.id]);
      });
    });

    it('remover aluno que não está na turma → 404 "Aluno não encontrado nesta turma."', async () => {
      const classroom = await createClassroom(prisma, {
        teacherId: teacherA.id,
      });
      const other = await createClassroom(prisma, { teacherId: teacherA.id });
      const student = await createUser(prisma);
      await prisma.classroomStudent.create({
        data: { classroomId: other.id, studentId: student.id },
      });

      for (const studentId of [student.id, 99999, 'abc']) {
        await http()
          .delete(`/api/v1/classrooms/${classroom.id}/students/${studentId}`)
          .set(as(teacherA.token))
          .expect(404)
          .expect(({ body }) =>
            expect(body.message).toBe('Aluno não encontrado nesta turma.'),
          );
      }
      expect(await prisma.classroomStudent.count()).toBe(1);
    });
  });

  it('aluno não acessa as rotas de turma da equipe (403)', async () => {
    const student = await session(Role.Student);
    const classroom = await createClassroom(prisma, { teacherId: teacherA.id });

    await http().get('/api/v1/classrooms').set(as(student.token)).expect(403);
    await http()
      .get(`/api/v1/classrooms/${classroom.id}`)
      .set(as(student.token))
      .expect(403);
    await http()
      .post('/api/v1/classrooms')
      .set(as(student.token))
      .send({ name: 'Turma' })
      .expect(403);
    await http().get('/api/v1/classrooms').expect(401);
  });
});
