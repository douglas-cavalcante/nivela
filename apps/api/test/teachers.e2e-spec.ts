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
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

describe('Professores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (email: string, password = DEFAULT_PASSWORD) =>
    http().post('/api/v1/auth/login').send({ email, password, channel: 'web' });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await tokenFor(app, Role.Admin);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, lista e edita um professor', async () => {
    const created = await http()
      .post('/api/v1/teachers')
      .set(as(admin))
      .send({
        name: '  Maria Souza ',
        email: ' Maria@Escola.test ',
        password: 'segredo123',
      })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(Number),
      name: 'Maria Souza',
      email: 'maria@escola.test',
      active: true,
      classrooms_count: 0,
      created_at: expect.any(String),
    });
    expect(created.body).not.toHaveProperty('password');
    const id = created.body.id as number;

    await login('maria@escola.test', 'segredo123').expect(200);

    const list = await http()
      .get('/api/v1/teachers')
      .set(as(admin))
      .expect(200);
    expect(list.body.data).toEqual([created.body]);
    expect(list.body.meta).toEqual({
      page: 1,
      per_page: 15,
      total: 1,
      last_page: 1,
    });

    const updated = await http()
      .put(`/api/v1/teachers/${id}`)
      .set(as(admin))
      .send({ name: 'Maria S. Lima', email: 'maria.lima@escola.test' })
      .expect(200);
    expect(updated.body).toMatchObject({
      id,
      name: 'Maria S. Lima',
      email: 'maria.lima@escola.test',
    });
  });

  it('conta as turmas do professor', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    await createClassroom(prisma, { teacherId: teacher.id });
    await createClassroom(prisma, { teacherId: teacher.id });

    const { body } = await http()
      .get('/api/v1/teachers')
      .set(as(admin))
      .expect(200);

    expect(body.data).toEqual([
      expect.objectContaining({ id: teacher.id, classrooms_count: 2 }),
    ]);
  });

  it('lista só professores, por nome, com paginação', async () => {
    await createUser(prisma, { role: Role.Student, name: 'Aluno' });
    await createUser(prisma, { role: Role.Teacher, name: 'Carla' });
    await createUser(prisma, { role: Role.Teacher, name: 'Ana' });
    await createUser(prisma, { role: Role.Teacher, name: 'Bruno' });

    const first = await http()
      .get('/api/v1/teachers?per_page=2')
      .set(as(admin))
      .expect(200);
    expect(first.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Ana',
      'Bruno',
    ]);
    expect(first.body.meta).toMatchObject({ total: 3, last_page: 2 });

    const second = await http()
      .get('/api/v1/teachers?per_page=2&page=2')
      .set(as(admin))
      .expect(200);
    expect(second.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Carla',
    ]);
  });

  it('filtra por situação', async () => {
    await createUser(prisma, { role: Role.Teacher, name: 'Ativa' });
    await createUser(prisma, {
      role: Role.Teacher,
      name: 'Inativo',
      active: false,
    });

    const active = await http()
      .get('/api/v1/teachers?status=active')
      .set(as(admin))
      .expect(200);
    expect(active.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Ativa',
    ]);

    const inactive = await http()
      .get('/api/v1/teachers?status=inactive')
      .set(as(admin))
      .expect(200);
    expect(inactive.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Inativo',
    ]);

    await http()
      .get('/api/v1/teachers?status=outro')
      .set(as(admin))
      .expect(422);
  });

  describe('busca', () => {
    const names = async (query: string) => {
      const { body } = await http()
        .get(`/api/v1/teachers?search=${encodeURIComponent(query)}`)
        .set(as(admin))
        .expect(200);
      return body.data.map((t: { name: string }) => t.name);
    };

    it('encontra por parte do nome ou do e-mail, sem diferenciar maiúsculas', async () => {
      await createUser(prisma, {
        role: Role.Teacher,
        name: 'Fernanda Lima',
        email: 'fer@escola.test',
      });
      await createUser(prisma, {
        role: Role.Teacher,
        name: 'Outro',
        email: 'outro@escola.test',
      });

      expect(await names('FERNA')).toEqual(['Fernanda Lima']);
      expect(await names('OUTRO@ESC')).toEqual(['Outro']);
      expect(await names('  fernanda ')).toEqual(['Fernanda Lima']);
    });

    it('trata % e _ digitados como texto literal', async () => {
      await createUser(prisma, { role: Role.Teacher, name: 'joao_silva' });
      await createUser(prisma, { role: Role.Teacher, name: 'joaoxsilva' });

      expect(await names('joao_')).toEqual(['joao_silva']);
      expect(await names('%')).toEqual([]);
    });
  });

  it('e-mail duplicado → 422 ao criar e ao editar', async () => {
    await createUser(prisma, { email: 'ocupado@escola.test' });
    const other = await createUser(prisma, { role: Role.Teacher });

    const create = await http()
      .post('/api/v1/teachers')
      .set(as(admin))
      .send({
        name: 'Novo Professor',
        email: 'OCUPADO@escola.test',
        password: 'segredo123',
      })
      .expect(422);
    expect(create.body.errors.email).toEqual([
      'Este e-mail já está cadastrado.',
    ]);

    const update = await http()
      .put(`/api/v1/teachers/${other.id}`)
      .set(as(admin))
      .send({ name: 'Qualquer', email: 'ocupado@escola.test' })
      .expect(422);
    expect(update.body.errors.email).toEqual([
      'Este e-mail já está cadastrado.',
    ]);
  });

  it('valida o corpo', async () => {
    const { body } = await http()
      .post('/api/v1/teachers')
      .set(as(admin))
      .send({ name: 'A', email: 'invalido', password: 'curta' })
      .expect(422);
    expect(Object.keys(body.errors).sort()).toEqual([
      'email',
      'name',
      'password',
    ]);
  });

  it('professor e aluno não acessam (403) e sem token é 401', async () => {
    const teacher = await tokenFor(app, Role.Teacher);
    const student = await tokenFor(app, Role.Student);

    for (const token of [teacher, student]) {
      await http().get('/api/v1/teachers').set(as(token)).expect(403);
      await http()
        .post('/api/v1/teachers')
        .set(as(token))
        .send({
          name: 'Fulano',
          email: 'f@escola.test',
          password: 'segredo123',
        })
        .expect(403);
      await http()
        .patch('/api/v1/teachers/1/status')
        .set(as(token))
        .send({ active: false })
        .expect(403);
    }
    await http().get('/api/v1/teachers').expect(401);
  });

  it('PUT, PATCH status e PUT senha de aluno/admin/inexistente → 404', async () => {
    const student = await createUser(prisma, { role: Role.Student });
    const other = await createUser(prisma, { role: Role.Admin });

    for (const id of [student.id, other.id, 999999]) {
      const put = await http()
        .put(`/api/v1/teachers/${id}`)
        .set(as(admin))
        .send({ name: 'Qualquer', email: 'qualquer@escola.test' })
        .expect(404);
      expect(put.body.message).toBe('Professor não encontrado.');

      await http()
        .patch(`/api/v1/teachers/${id}/status`)
        .set(as(admin))
        .send({ active: false })
        .expect(404);
      await http()
        .put(`/api/v1/teachers/${id}/password`)
        .set(as(admin))
        .send({ password: 'novasenha1', password_confirmation: 'novasenha1' })
        .expect(404);
    }
    expect(
      (await prisma.user.findUnique({ where: { id: student.id } }))?.active,
    ).toBe(true);
  });

  it('desativar revoga as sessões; login dá 403; reativar libera o login', async () => {
    const teacher = await createUser(prisma, {
      role: Role.Teacher,
      email: 'prof@escola.test',
    });
    const first = (await login('prof@escola.test').expect(200)).body
      .token as string;
    const second = (await login('prof@escola.test').expect(200)).body
      .token as string;
    await http().get('/api/v1/auth/me').set(as(first)).expect(200);

    const off = await http()
      .patch(`/api/v1/teachers/${teacher.id}/status`)
      .set(as(admin))
      .send({ active: false })
      .expect(200);
    expect(off.body).toMatchObject({ id: teacher.id, active: false });

    await http().get('/api/v1/auth/me').set(as(first)).expect(401);
    await http().get('/api/v1/auth/me').set(as(second)).expect(401);
    expect(
      await prisma.accessToken.count({ where: { userId: teacher.id } }),
    ).toBe(0);
    const blocked = await login('prof@escola.test').expect(403);
    expect(blocked.body.message).toBe('Usuário desativado.');

    const on = await http()
      .patch(`/api/v1/teachers/${teacher.id}/status`)
      .set(as(admin))
      .send({ active: true })
      .expect(200);
    expect(on.body.active).toBe(true);
    await login('prof@escola.test').expect(200);
    await http().get('/api/v1/auth/me').set(as(first)).expect(401);
  });

  it('valida o corpo do status', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    await http()
      .patch(`/api/v1/teachers/${teacher.id}/status`)
      .set(as(admin))
      .send({ active: 'sim' })
      .expect(422);
  });

  it('trocar a senha revoga as sessões e vale no próximo login', async () => {
    const teacher = await createUser(prisma, {
      role: Role.Teacher,
      email: 'prof@escola.test',
    });
    const token = (await login('prof@escola.test').expect(200)).body
      .token as string;

    await http()
      .put(`/api/v1/teachers/${teacher.id}/password`)
      .set(as(admin))
      .send({ password: 'novasenha1', password_confirmation: 'novasenha1' })
      .expect(204);

    await http().get('/api/v1/auth/me').set(as(token)).expect(401);
    await login('prof@escola.test').expect(422);
    await login('prof@escola.test', 'novasenha1').expect(200);
  });

  it('confirmação de senha diferente → 422 e nada muda', async () => {
    const teacher = await createUser(prisma, { role: Role.Teacher });
    const { body } = await http()
      .put(`/api/v1/teachers/${teacher.id}/password`)
      .set(as(admin))
      .send({ password: 'novasenha1', password_confirmation: 'outrasenha1' })
      .expect(422);
    expect(body.errors.password_confirmation).toEqual([
      'A confirmação de senha não confere.',
    ]);
    await login(teacher.email).expect(200);
  });
});
