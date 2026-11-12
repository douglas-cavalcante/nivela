import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import {
  createClassroom,
  createReward,
  createUser,
} from './helpers/factories';
import { sessionFor, tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';
import { createUploadsDir, removeUploadsDir } from './helpers/uploads';

const NOT_FOUND = { message: 'Prêmio não encontrado.' };
const FORBIDDEN = {
  message: 'Só quem cadastrou ou um administrador pode editar este prêmio.',
};

describe('Prêmios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploads: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const body = (overrides: Record<string, unknown> = {}) => ({
    name: 'Caderno',
    description: 'Caderno de 100 folhas.',
    price: 50,
    stock: 3,
    ...overrides,
  });

  beforeAll(async () => {
    uploads = await createUploadsDir();
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await removeUploadsDir(uploads);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  describe('cadastro', () => {
    it('professor cadastra e vira o autor (201)', async () => {
      const { user, token } = await sessionFor(app, Role.Teacher);
      const res = await http()
        .post('/api/v1/rewards')
        .set(as(token))
        .send(body())
        .expect(201);
      expect(res.body).toEqual({
        id: expect.any(Number) as number,
        name: 'Caderno',
        description: 'Caderno de 100 folhas.',
        image_url: null,
        price: 50,
        stock: 3,
        active: true,
        created_by: { id: user.id, name: user.name },
        can_edit: true,
        pending_redemptions: 0,
        updated_at: expect.any(String) as string,
      });
    });

    it('descrição é opcional e vazia vira null; nome é aparado', async () => {
      const token = await tokenFor(app, Role.Teacher);
      const res = await http()
        .post('/api/v1/rewards')
        .set(as(token))
        .send(body({ name: '  Lápis  ', description: '   ' }))
        .expect(201);
      expect(res.body.name).toBe('Lápis');
      expect(res.body.description).toBeNull();
      const semCampo = await http()
        .post('/api/v1/rewards')
        .set(as(token))
        .send({ name: 'Borracha', price: 1, stock: 0 })
        .expect(201);
      expect(semCampo.body.description).toBeNull();
    });

    it('valida os campos (422)', async () => {
      const token = await tokenFor(app, Role.Teacher);
      const post = (payload: Record<string, unknown>) =>
        http().post('/api/v1/rewards').set(as(token)).send(payload);

      expect((await post(body({ price: 0 })).expect(422)).body.errors).toEqual({
        price: ['O preço deve ser um número inteiro de 1 a 100000.'],
      });
      await post(body({ price: 100001 })).expect(422);
      await post(body({ price: 1.5 })).expect(422);
      expect((await post(body({ stock: -1 })).expect(422)).body.errors).toEqual(
        { stock: ['O estoque deve ser um número inteiro de 0 a 100000.'] },
      );
      await post(body({ stock: 100001 })).expect(422);
      await post(body({ name: 'A' })).expect(422);
      await post(body({ name: 'x'.repeat(81) })).expect(422);
      await post(body({ description: 'x'.repeat(501) })).expect(422);
      await post(body({ price: '10' })).expect(422);
      // Limites válidos.
      await post(body({ price: 1, stock: 0 })).expect(201);
      await post(body({ price: 100000, stock: 100000 })).expect(201);
      expect(await prisma.reward.count()).toBe(2);
    });

    it('aluno → 403; sem token → 401', async () => {
      const student = await tokenFor(app, Role.Student);
      await http()
        .post('/api/v1/rewards')
        .set(as(student))
        .send(body())
        .expect(403);
      await http().get('/api/v1/rewards').set(as(student)).expect(403);
      await http().get('/api/v1/rewards').expect(401);
      expect(await prisma.reward.count()).toBe(0);
    });
  });

  describe('listagem e detalhe', () => {
    it('lista por nome com busca, situação e paginação; todos veem o catálogo da escola', async () => {
      const other = await createUser(prisma, { role: Role.Teacher });
      const teacher = await tokenFor(app, Role.Teacher);
      await createReward(prisma, { createdBy: other.id, name: 'Caneta azul' });
      await createReward(prisma, { createdBy: other.id, name: 'Borracha' });
      await createReward(prisma, {
        createdBy: other.id,
        name: 'Caneta verde',
        active: false,
      });

      const all = await http()
        .get('/api/v1/rewards')
        .set(as(teacher))
        .expect(200);
      expect(all.body.data.map((r: { name: string }) => r.name)).toEqual([
        'Borracha',
        'Caneta azul',
        'Caneta verde',
      ]);
      expect(all.body.meta).toEqual({
        page: 1,
        per_page: 15,
        total: 3,
        last_page: 1,
      });
      expect(all.body.data[0].can_edit).toBe(false);

      const search = await http()
        .get('/api/v1/rewards?search=CANETA')
        .set(as(teacher))
        .expect(200);
      expect(search.body.meta.total).toBe(2);
      const inactive = await http()
        .get('/api/v1/rewards?status=inactive&search=')
        .set(as(teacher))
        .expect(200);
      expect(inactive.body.data.map((r: { name: string }) => r.name)).toEqual([
        'Caneta verde',
      ]);
      const active = await http()
        .get('/api/v1/rewards?status=active&per_page=1&page=2')
        .set(as(teacher))
        .expect(200);
      expect(active.body.data).toHaveLength(1);
      expect(active.body.meta.last_page).toBe(2);
      await http()
        .get('/api/v1/rewards?status=qualquer')
        .set(as(teacher))
        .expect(422);
    });

    it('conta os resgates pendentes só dos alunos do escopo (RN15)', async () => {
      const teacher = await sessionFor(app, Role.Teacher);
      const admin = await tokenFor(app, Role.Admin);
      const reward = await createReward(prisma, { name: 'Boné' });
      const student = await createUser(prisma);
      const make = (status: 'pending' | 'delivered') =>
        prisma.rewardRedemption.create({
          data: {
            rewardId: reward.id,
            studentId: student.id,
            pricePaid: 10,
            status,
          },
        });
      await make('pending');
      await make('pending');
      await make('delivered');

      const pendingFor = async (token: string) => {
        const one = await http()
          .get(`/api/v1/rewards/${reward.id}`)
          .set(as(token))
          .expect(200);
        const list = await http()
          .get('/api/v1/rewards')
          .set(as(token))
          .expect(200);
        expect(list.body.data[0].pending_redemptions).toBe(
          one.body.pending_redemptions,
        );
        return one.body.pending_redemptions as number;
      };

      // Professor sem o aluno em nenhuma turma não vê os resgates dele.
      expect(await pendingFor(teacher.token)).toBe(0);
      expect(await pendingFor(admin)).toBe(2);

      // Com o aluno numa turma do professor, vê os dois.
      const classroom = await createClassroom(prisma, {
        teacherId: teacher.user.id,
      });
      await prisma.classroomStudent.create({
        data: { classroomId: classroom.id, studentId: student.id },
      });
      expect(await pendingFor(teacher.token)).toBe(2);
    });

    it('inexistente → 404 "Prêmio não encontrado."', async () => {
      const teacher = await tokenFor(app, Role.Teacher);
      const res = await http()
        .get('/api/v1/rewards/999')
        .set(as(teacher))
        .expect(404);
      expect(res.body).toEqual(NOT_FOUND);
      await http().get('/api/v1/rewards/abc').set(as(teacher)).expect(404);
    });
  });

  describe('edição', () => {
    it('quem criou edita (PUT) e o estoque é substituído', async () => {
      const { user, token } = await sessionFor(app, Role.Teacher);
      const reward = await createReward(prisma, { createdBy: user.id });
      const res = await http()
        .put(`/api/v1/rewards/${reward.id}`)
        .set(as(token))
        .send(body({ name: 'Novo nome', price: 80, stock: 9 }))
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Novo nome',
        price: 80,
        stock: 9,
        can_edit: true,
      });
    });

    it('outro professor → 403 e nada muda; administrador → 200', async () => {
      const author = await createUser(prisma, { role: Role.Teacher });
      const reward = await createReward(prisma, {
        createdBy: author.id,
        name: 'Original',
      });
      const other = await tokenFor(app, Role.Teacher);
      const res = await http()
        .put(`/api/v1/rewards/${reward.id}`)
        .set(as(other))
        .send(body())
        .expect(403);
      expect(res.body).toEqual(FORBIDDEN);
      await http()
        .patch(`/api/v1/rewards/${reward.id}/status`)
        .set(as(other))
        .send({ active: false })
        .expect(403);
      expect(
        await prisma.reward.findUniqueOrThrow({ where: { id: reward.id } }),
      ).toMatchObject({ name: 'Original', active: true });

      const admin = await tokenFor(app, Role.Admin);
      const ok = await http()
        .put(`/api/v1/rewards/${reward.id}`)
        .set(as(admin))
        .send(body({ name: 'Pelo admin' }))
        .expect(200);
      expect(ok.body).toMatchObject({ name: 'Pelo admin', can_edit: true });
      expect(ok.body.created_by.id).toBe(author.id);
    });

    it('aluno → 403; inexistente → 404; payload inválido → 422', async () => {
      const { user, token } = await sessionFor(app, Role.Teacher);
      const reward = await createReward(prisma, { createdBy: user.id });
      const student = await tokenFor(app, Role.Student);
      await http()
        .put(`/api/v1/rewards/${reward.id}`)
        .set(as(student))
        .send(body())
        .expect(403);
      const nf = await http()
        .put('/api/v1/rewards/999')
        .set(as(token))
        .send(body())
        .expect(404);
      expect(nf.body).toEqual(NOT_FOUND);
      await http()
        .put(`/api/v1/rewards/${reward.id}`)
        .set(as(token))
        .send(body({ price: 0 }))
        .expect(422);
    });

    it('PATCH status ativa e desativa; valida o corpo', async () => {
      const { user, token } = await sessionFor(app, Role.Teacher);
      const reward = await createReward(prisma, { createdBy: user.id });
      const off = await http()
        .patch(`/api/v1/rewards/${reward.id}/status`)
        .set(as(token))
        .send({ active: false })
        .expect(200);
      expect(off.body.active).toBe(false);
      const on = await http()
        .patch(`/api/v1/rewards/${reward.id}/status`)
        .set(as(token))
        .send({ active: true })
        .expect(200);
      expect(on.body.active).toBe(true);
      await http()
        .patch(`/api/v1/rewards/${reward.id}/status`)
        .set(as(token))
        .send({ active: 'sim' })
        .expect(422);
      await http()
        .patch('/api/v1/rewards/999/status')
        .set(as(token))
        .send({ active: true })
        .expect(404);
    });

    it('não há exclusão de prêmio', async () => {
      const { user, token } = await sessionFor(app, Role.Admin);
      const reward = await createReward(prisma, { createdBy: user.id });
      await http()
        .delete(`/api/v1/rewards/${reward.id}`)
        .set(as(token))
        .expect(404);
      expect(await prisma.reward.count()).toBe(1);
    });
  });

  describe('vitrine do aluno', () => {
    it('só ativos, por preço e nome, com affordable pelo saldo', async () => {
      const student = await sessionFor(app, Role.Student);
      await prisma.studentProfile.update({
        where: { userId: student.user.id },
        data: { coinsBalance: 50 },
      });
      await createReward(prisma, { name: 'Caro', price: 51 });
      await createReward(prisma, { name: 'Exato', price: 50 });
      await createReward(prisma, { name: 'Barato B', price: 10 });
      await createReward(prisma, { name: 'Barato A', price: 10, stock: 0 });
      await createReward(prisma, { name: 'Inativo', price: 1, active: false });

      const res = await http()
        .get('/api/v1/store/rewards')
        .set(as(student.token))
        .expect(200);
      expect(
        res.body.data.map((r: { name: string; affordable: boolean }) => [
          r.name,
          r.affordable,
        ]),
      ).toEqual([
        ['Barato A', true],
        ['Barato B', true],
        ['Exato', true],
        ['Caro', false],
      ]);
      expect(res.body.data[0]).toEqual({
        id: expect.any(Number) as number,
        name: 'Barato A',
        description: null,
        image_url: null,
        price: 10,
        stock: 0,
        affordable: true,
      });
    });

    it('professor e administrador não usam a vitrine (403); sem token → 401', async () => {
      for (const role of [Role.Teacher, Role.Admin]) {
        const token = await tokenFor(app, role);
        await http().get('/api/v1/store/rewards').set(as(token)).expect(403);
      }
      await http().get('/api/v1/store/rewards').expect(401);
    });
  });

  describe('restrições do banco', () => {
    it('recusa preço e estoque fora do limite e recusa sem motivo', async () => {
      await expect(createReward(prisma, { price: 0 })).rejects.toThrow();
      await expect(createReward(prisma, { price: 100001 })).rejects.toThrow();
      await expect(createReward(prisma, { stock: -1 })).rejects.toThrow();
      const reward = await createReward(prisma);
      const student = await createUser(prisma);
      const redemption = (status: 'rejected', rejectionReason?: string) =>
        prisma.rewardRedemption.create({
          data: {
            rewardId: reward.id,
            studentId: student.id,
            pricePaid: 10,
            status,
            rejectionReason,
          },
        });
      await expect(redemption('rejected')).rejects.toThrow();
      await expect(redemption('rejected', '  ')).rejects.toThrow();
      await redemption('rejected', 'Sem estoque.');
    });
  });
});
