import { Logger } from '@nestjs/common';
import {
  PlanCompletionService,
  type PlanStates,
} from 'src/modules/leveling-plans/plan-completion.service';
import type { PrismaService } from 'src/prisma/prisma.service';
import type { CoinLedger } from 'src/shared/coins/coin-ledger';

describe('PlanCompletionService.loadSettled', () => {
  const pendingState = { pendingPlan: true, pendingChapters: [] };
  const states = (): PlanStates =>
    new Map([
      [1, new Map([[9, pendingState]])],
      [2, new Map([[9, pendingState]])],
    ]) as unknown as PlanStates;

  afterEach(() => jest.restoreAllMocks());

  it('falha ao assentar um aluno não derruba os outros e é registrada', async () => {
    const service = new PlanCompletionService(
      {} as PrismaService,
      {} as CoinLedger,
    );
    const load = jest.spyOn(service, 'load').mockImplementation(() => {
      return Promise.resolve(states());
    });
    const failure = new Error('deadlock');
    const settle = jest
      .spyOn(service, 'settle')
      .mockImplementation((studentId) =>
        studentId === 1 ? Promise.reject(failure) : Promise.resolve(),
      );
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.loadSettled([1, 2], [9], 'plan'),
    ).resolves.toBeDefined();

    expect(settle).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledWith(2, 9);
    expect(error).toHaveBeenCalledWith(
      'Falha ao assentar a conclusão do aluno 1 no plano 9.',
      failure.stack,
    );
    // Recarrega os estados, inclusive o do aluno que falhou.
    expect(load).toHaveBeenCalledTimes(2);
  });
});
