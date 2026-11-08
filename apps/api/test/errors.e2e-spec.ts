import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { resetDatabase } from './helpers/reset-database';
import { TestErrorsController } from './helpers/test-errors.controller';

describe('Formato de erros (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([TestErrorsController]);
    await resetDatabase(app.get(PrismaService));
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

  it('JSON malformado → 400 em pt-BR, sem texto do parser', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/validation')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body).toEqual({ message: 'Requisição inválida.' });
  });

  it('corpo grande demais → 413 em pt-BR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/validation')
      .send({ name: 'a'.repeat(200_000) })
      .expect(413);
    expect(res.body).toEqual({ message: 'Requisição muito grande.' });
  });

  it('pipe do Nest (ParseIntPipe) → 400 em pt-BR, sem "Validation failed"', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/int/abc')
      .expect(400);
    expect(res.body).toEqual({ message: 'Requisição inválida.' });
  });

  it('parâmetro com codificação inválida (URIError) → 400 em pt-BR', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/int/%FF')
      .expect(400);
    expect(res.body).toEqual({ message: 'Requisição inválida.' });
  });

  it('mensagem própria com "JSON" no texto passa sem alteração', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/json-field')
      .expect(400);
    expect(res.body).toEqual({ message: 'Campo JSON inválido.' });
  });

  it('arquivo acima do limite (multer) → 413 em pt-BR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/upload')
      .attach('file', Buffer.from('conteúdo maior que dez bytes'), 'a.txt')
      .expect(413);
    expect(res.body).toEqual({ message: 'Arquivo muito grande.' });
  });

  it('campo de arquivo inesperado (multer) → 400 em pt-BR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/upload')
      .attach('outro', Buffer.from('x'), 'a.txt')
      .expect(400);
    expect(res.body).toEqual({ message: 'Requisição inválida.' });
  });

  it('multipart não suportado → 415 em pt-BR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/upload')
      .set('Content-Type', 'multipart/mixed; boundary=x')
      .send('--x--')
      .expect(415);
    expect(res.body).toEqual({ message: 'Tipo de conteúdo não suportado.' });
  });

  it('ParseUUIDPipe → 400 "Identificador inválido."', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/uuid/abc')
      .expect(400);
    expect(res.body).toEqual({ message: 'Identificador inválido.' });
  });

  it('ParseArrayPipe → 400 "Lista inválida." (lista ausente ou item inválido)', async () => {
    const item = await request(app.getHttpServer())
      .get('/api/v1/__test/ids?ids=1,x')
      .expect(400);
    expect(item.body).toEqual({ message: 'Lista inválida.' });
    const missing = await request(app.getHttpServer())
      .get('/api/v1/__test/ids')
      .expect(400);
    expect(missing.body).toEqual({ message: 'Lista inválida.' });
  });

  it('ParseFilePipe sem arquivo → 400 "Envie um arquivo."', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/__test/required-file')
      .field('campo', 'valor')
      .expect(400);
    expect(res.body).toEqual({ message: 'Envie um arquivo.' });
  });

  it('ParseFilePipe com arquivo grande ou de outro tipo → 400 em pt-BR', async () => {
    const big = await request(app.getHttpServer())
      .post('/api/v1/__test/checked-file')
      .attach('file', Buffer.from('conteúdo maior que cinco bytes'), 'a.png')
      .expect(400);
    expect(big.body).toEqual({ message: 'Arquivo muito grande.' });
    const type = await request(app.getHttpServer())
      .post('/api/v1/__test/checked-file')
      .attach('file', Buffer.from('abc'), {
        filename: 'a.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(type.body).toEqual({ message: 'Tipo de arquivo não suportado.' });
  });

  it('4xx sem mensagem própria → "Requisição inválida.", sem log', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error');
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/gone')
      .expect(410);
    expect(res.body).toEqual({ message: 'Requisição inválida.' });
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });

  it('HttpException 5xx → mensagem genérica e registrada no log', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const res = await request(app.getHttpServer())
      .get('/api/v1/__test/unavailable')
      .expect(503);
    expect(res.body).toEqual({ message: 'Erro interno do servidor.' });
    expect(logger).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('ServiceUnavailableException'),
    );
    logger.mockRestore();
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
