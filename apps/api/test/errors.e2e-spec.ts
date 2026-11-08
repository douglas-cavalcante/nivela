import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-test-app';
import { TestErrorsController } from './helpers/test-errors.controller';

describe('Formato de erros (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([TestErrorsController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rota inexistente → 404 {message}', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/nao-existe')
      .expect(404);
    expect(res.body).toEqual({ message: 'Recurso não encontrado.' });
  });

  it('DTO inválido → 422 com errors por campo', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/validation')
      .send({})
      .expect(422);
    expect(res.body.message).toBe('Os dados enviados são inválidos.');
    expect(res.body.errors.name[0]).toBe('O nome é obrigatório.');
  });

  it('BusinessRuleException → 409', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/conflict')
      .expect(409);
    expect(res.body).toEqual({ message: 'Saldo insuficiente.' });
  });

  it('erro inesperado → 500 sem stack', async () => {
    // O filtro registra o erro real no log; silenciado para não poluir a saída.
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/boom')
      .expect(500);
    expect(res.body).toEqual({ message: 'Erro interno do servidor.' });
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});
