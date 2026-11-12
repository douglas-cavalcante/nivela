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

/** Corpo de `POST /rewards` e `PUT /rewards/:id`. */
export interface RewardPayload {
  name: string;
  description?: string | null;
  price: number;
  stock: number;
}
