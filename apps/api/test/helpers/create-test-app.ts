import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { configureApp } from 'src/app.factory';
import { CLOCK } from 'src/shared/clock/clock';
import { TestClock } from './test-clock';

/**
 * Sobe o app inteiro com a mesma configuração do main.ts (prefixo, validação,
 * filtro de erros). `controllers` registra rotas só de teste. O `CLOCK` é um
 * `TestClock` fixo (`testClock(app)` o devolve para mudar o instante).
 */
export async function createTestApp(
  controllers: Type<unknown>[] = [],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    .overrideProvider(CLOCK)
    .useValue(new TestClock())
    .compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

/** O relógio fixo do app de teste. */
export function testClock(app: INestApplication): TestClock {
  return app.get<TestClock>(CLOCK);
}
