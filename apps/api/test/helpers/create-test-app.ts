import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.factory';

/**
 * Sobe o app inteiro com a mesma configuração do main.ts (prefixo, validação,
 * filtro de erros). `controllers` registra rotas só de teste.
 */
export async function createTestApp(
  controllers: Type<unknown>[] = [],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  }).compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}
