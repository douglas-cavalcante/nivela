import { z } from 'zod';

const BONUS_MESSAGE = 'O bônus deve ser um número inteiro de 0 a 500.';

export const planSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título do plano.')
    .min(3, 'O título deve ter pelo menos 3 caracteres.')
    .max(120, 'O título deve ter no máximo 120 caracteres.'),
  description: z.string().trim().max(1000, 'A descrição deve ter no máximo 1000 caracteres.'),
  subject_id: z.string().min(1, 'Escolha a disciplina.'),
  completion_bonus: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, BONUS_MESSAGE)
    .refine((value) => Number(value) <= 500, BONUS_MESSAGE),
});

export type PlanFormValues = z.infer<typeof planSchema>;

export const chapterSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título do capítulo.')
    .min(2, 'O título deve ter pelo menos 2 caracteres.')
    .max(120, 'O título deve ter no máximo 120 caracteres.'),
});

export type ChapterFormValues = z.infer<typeof chapterSchema>;

/** Corpo de `POST /plans` e `PUT /plans/:id`. */
export interface PlanPayload {
  title: string;
  description: string | null;
  subject_id: number;
  completion_bonus: number;
}

/** Corpo de `POST /plans/:id/assignments`: uma turma OU um aluno. */
export interface AssignmentPayload {
  classroom_id?: number;
  student_id?: number;
  due_date: string | null;
}
