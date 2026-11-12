import { z } from 'zod';

/** Mesma regra da API: sem espaços, maiúsculas e hífen depois de `NIV` ("niv 4k7q" → "NIV-4K7Q"). */
export function normalizeJoinCode(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  return /^NIV[^-]/.test(compact) ? `NIV-${compact.slice(3)}` : compact;
}

export const joinSchema = z.object({
  join_code: z.string().trim().min(1, 'Informe o código da turma.').transform(normalizeJoinCode),
});

export type JoinFormValues = z.input<typeof joinSchema>;
export type JoinPayloadValues = z.output<typeof joinSchema>;
