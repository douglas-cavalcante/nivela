import {
  presentCoinTransaction,
  type CoinSources,
  type CoinTransactionRow,
} from 'src/modules/dashboard/presenters/coin-transaction.presenter';

const sources: CoinSources = {
  statements: new Map([[1, 'Quanto é 2 + 2?']]),
  planTitles: new Map([[2, 'Frações']]),
  rewardNames: new Map([[3, 'Caderno']]),
};

function row(
  reason: CoinTransactionRow['reason'],
  sourceId: number,
): CoinTransactionRow {
  return {
    id: 9,
    amount: 5,
    reason,
    sourceId,
    createdAt: new Date('2026-11-10T15:00:00Z'),
  };
}

describe('presentCoinTransaction', () => {
  it('descreve cada motivo em português', () => {
    const describe = (reason: CoinTransactionRow['reason'], id: number) =>
      presentCoinTransaction(row(reason, id), sources).description;
    expect(describe('correct_answer', 1)).toBe('Acerto: Quanto é 2 + 2?.');
    expect(describe('plan_completed', 2)).toBe('Plano concluído: Frações.');
    expect(describe('redemption', 3)).toBe('Resgate: Caderno.');
    expect(describe('refund', 3)).toBe('Estorno: Caderno.');
  });

  it('converte o dayNumber do bônus de sequência em dd/mm/aaaa, sem buscar entidade', () => {
    // 20767 = 2026-11-10; 0 = 1970-01-01.
    const empty: CoinSources = {
      statements: new Map(),
      planTitles: new Map(),
      rewardNames: new Map(),
    };
    expect(
      presentCoinTransaction(row('streak_bonus', 20767), empty).description,
    ).toBe('Sequência de 7 dias (até 10/11/2026).');
    expect(
      presentCoinTransaction(row('streak_bonus', 0), empty).description,
    ).toBe('Sequência de 7 dias (até 01/01/1970).');
  });

  it('não quebra se a entidade de origem sumiu', () => {
    const empty: CoinSources = {
      statements: new Map(),
      planTitles: new Map(),
      rewardNames: new Map(),
    };
    expect(presentCoinTransaction(row('refund', 3), empty).description).toBe(
      'Estorno.',
    );
  });

  it('devolve o formato do contrato', () => {
    expect(presentCoinTransaction(row('refund', 3), sources)).toEqual({
      id: 9,
      amount: 5,
      reason: 'refund',
      description: 'Estorno: Caderno.',
      created_at: '2026-11-10T15:00:00.000Z',
    });
  });
});
