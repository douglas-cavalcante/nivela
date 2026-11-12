import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Informe o nome da categoria.')
  .min(2, 'O nome deve ter pelo menos 2 caracteres.')
  .max(80, 'O nome deve ter no máximo 80 caracteres.');

/** Edição: só o nome muda (o campo da disciplina existe no tipo, mas fica vazio e não é enviado). */
export const updateCategorySchema = z.object({ name, subject_id: z.string() });

/** Criação: nome e disciplina (o select entrega o id como texto; '' = nada escolhido). */
export const createCategorySchema = z.object({
  name,
  subject_id: z.string().min(1, 'Escolha uma disciplina.'),
});

export type CategoryFormValues = z.infer<typeof createCategorySchema>;
