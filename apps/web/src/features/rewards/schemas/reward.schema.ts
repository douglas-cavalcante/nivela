import type { RewardPayload } from "@nivela/api-contract";
import { z } from "zod";

// Mesmas regras e mensagens do RewardDto e do RejectRedemptionDto da API.
const PRICE_MESSAGE = "O preço deve ser um número inteiro de 1 a 100000.";
const STOCK_MESSAGE = "O estoque deve ser um número inteiro de 0 a 100000.";
const REASON_MESSAGE = "O motivo deve ter de 3 a 300 caracteres.";

export const rewardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do prêmio.")
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(80, "O nome deve ter no máximo 80 caracteres."),
  description: z
    .string()
    .trim()
    .max(500, "A descrição deve ter no máximo 500 caracteres."),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, PRICE_MESSAGE)
    .refine(
      (value) => Number(value) >= 1 && Number(value) <= 100_000,
      PRICE_MESSAGE,
    ),
  stock: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, STOCK_MESSAGE)
    .refine((value) => Number(value) <= 100_000, STOCK_MESSAGE),
});

export type RewardFormValues = z.infer<typeof rewardSchema>;

/** Corpo de `POST /rewards` e `PUT /rewards/:id` a partir dos valores já validados. */
export function toRewardPayload(values: RewardFormValues): RewardPayload {
  return {
    name: values.name,
    description: values.description || null,
    price: Number(values.price),
    stock: Number(values.stock),
  };
}

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, REASON_MESSAGE).max(300, REASON_MESSAGE),
});

export type RejectFormValues = z.infer<typeof rejectSchema>;
