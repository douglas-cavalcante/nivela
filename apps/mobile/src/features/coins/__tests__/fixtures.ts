import type { ApiCoinTransaction } from '@nivela/api-contract';

export const refundTx: ApiCoinTransaction = {
  id: 4,
  amount: 50,
  reason: 'refund',
  description: 'Estorno do resgate: Caderno de desenho',
  created_at: '2026-11-10T15:00:00.000Z',
};

export const redemptionTx: ApiCoinTransaction = {
  id: 3,
  amount: -50,
  reason: 'redemption',
  description: 'Resgate: Caderno de desenho',
  created_at: '2026-11-09T15:00:00.000Z',
};

export const answerTx: ApiCoinTransaction = {
  id: 2,
  amount: 10,
  reason: 'correct_answer',
  description: 'Resposta correta',
  created_at: '2026-11-08T15:00:00.000Z',
};

export const streakTx: ApiCoinTransaction = {
  id: 1,
  amount: 5,
  reason: 'streak_bonus',
  description: 'Bônus de sequência',
  created_at: '2026-11-07T15:00:00.000Z',
};

export const stats = { status: 200, data: { coins_balance: 85, current_streak: 4, best_streak: 9 } };
