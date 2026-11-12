/** Estado de um resgate. */
export type RedemptionStatus = "pending" | "delivered" | "rejected";

/** Prêmio como aparece para a equipe (professor e administrador). */
export interface ApiReward {
  id: number;
  name: string;
  description: string | null;
  /**
   * Caminho da imagem relativo à raiz do servidor (`/uploads/rewards/<arquivo>`),
   * ou null. Para exibir, resolva com `resolveAssetUrl(apiBaseUrl, image_url)`.
   */
  image_url: string | null;
  price: number;
  stock: number;
  active: boolean;
  created_by: { id: number; name: string };
  /** Verdadeiro para quem cadastrou o prêmio e para o administrador. */
  can_edit: boolean;
  /** Resgates aguardando entrega ou recusa. */
  pending_redemptions: number;
  updated_at: string;
}

/** Prêmio na vitrine do aluno: só os ativos. */
export interface ApiStoreReward {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  /** Saldo de moedas do aluno >= preço. */
  affordable: boolean;
}

/** Corpo de `POST /rewards`. */
export interface RewardPayload {
  name: string;
  description?: string | null;
  price: number;
  stock: number;
}

/**
 * Corpo de `PUT /rewards/:id`: `stock` ausente significa "não muda" (editar só
 * o nome não desfaz uma baixa de estoque feita por um resgate).
 */
export type UpdateRewardPayload = Omit<RewardPayload, "stock"> & { stock?: number };

/** Resgate como o aluno vê (só os dele). */
export interface ApiMyRedemption {
  id: number;
  reward: { id: number; name: string; image_url: string | null };
  /** Preço no momento do resgate; não muda se o prêmio for reajustado depois. */
  price_paid: number;
  status: RedemptionStatus;
  /** Preenchido só quando o resgate foi recusado. */
  rejection_reason: string | null;
  created_at: string;
  /** Quando a equipe entregou ou recusou; null enquanto pendente. */
  handled_at: string | null;
}

/** Resgate na fila da equipe (professor e administrador). */
export interface ApiRedemption extends ApiMyRedemption {
  student: {
    id: number;
    name: string;
    /** Só as turmas que quem consulta pode ver. */
    classrooms: Array<{ id: number; name: string }>;
  };
  handled_by: { id: number; name: string } | null;
}

/** Resposta de `POST /store/rewards/:id/redeem`. */
export interface ApiRedeemResult {
  redemption: ApiMyRedemption;
  /** Saldo do aluno depois do resgate. */
  coins_balance: number;
  /** Estoque restante do prêmio. */
  stock: number;
}

/** Corpo de `POST /redemptions/:id/reject`. */
export interface RejectRedemptionPayload {
  reason: string;
}
