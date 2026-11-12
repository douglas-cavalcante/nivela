import type { ApiMyRedemption, ApiStoreReward } from '@nivela/api-contract';

export const caderno: ApiStoreReward = {
  id: 1,
  name: 'Caderno de desenho',
  description: 'Capa dura, 48 folhas.',
  image_url: '/uploads/rewards/caderno.png',
  price: 50,
  stock: 3,
  affordable: true,
};

export const mochila: ApiStoreReward = {
  id: 2,
  name: 'Mochila escolar',
  description: null,
  image_url: null,
  price: 300,
  stock: 5,
  affordable: false,
};

export const lapis: ApiStoreReward = {
  id: 3,
  name: 'Lápis de cor',
  description: null,
  image_url: null,
  price: 20,
  stock: 0,
  affordable: true,
};

export const pendingRedemption: ApiMyRedemption = {
  id: 11,
  reward: { id: 1, name: 'Caderno de desenho', image_url: null },
  price_paid: 50,
  status: 'pending',
  rejection_reason: null,
  created_at: '2026-11-10T15:00:00.000Z',
  handled_at: null,
};

export const rejectedRedemption: ApiMyRedemption = {
  id: 10,
  reward: { id: 2, name: 'Mochila escolar', image_url: null },
  price_paid: 300,
  status: 'rejected',
  rejection_reason: 'Prêmio indisponível na escola.',
  created_at: '2026-11-09T15:00:00.000Z',
  handled_at: '2026-11-09T18:00:00.000Z',
};

export const deliveredRedemption: ApiMyRedemption = {
  id: 9,
  reward: { id: 3, name: 'Lápis de cor', image_url: null },
  price_paid: 20,
  status: 'delivered',
  rejection_reason: null,
  created_at: '2026-11-08T15:00:00.000Z',
  handled_at: '2026-11-08T18:00:00.000Z',
};
