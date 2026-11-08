import type { Difficulty, OptionLetter, QuestionPayload } from '@nivela/api-contract';
import { z } from 'zod';

export const OPTION_LETTERS: readonly OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_WRONG_TYPE = 'Envie uma imagem JPG, PNG ou WEBP.';
export const IMAGE_TOO_BIG = 'A imagem deve ter no máximo 2 MB.';
export const OPTIONS_MESSAGE = 'Informe as 5 alternativas, de A a E.';

const ALLOWED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

/**
 * Checagem rápida no cliente (extensão e tipo MIME; a API confere a assinatura dos bytes de verdade).
 * Devolve a mensagem de erro, a mesma da API, ou `null` se o arquivo pode ser enviado.
 */
export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  const typeOk = file.type === '' || ALLOWED_IMAGE_TYPES.includes(file.type);
  if (!typeOk || !ALLOWED_IMAGE_EXTENSION.test(file.name)) return IMAGE_WRONG_TYPE;
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_TOO_BIG;
  return null;
}

// Mesmas regras e mensagens do QuestionDto da API.
const isDifficulty = (value: string): value is Difficulty => (DIFFICULTIES as readonly string[]).includes(value);
const isLetter = (value: string): value is OptionLetter => (OPTION_LETTERS as readonly string[]).includes(value);

const optionSchema = z.object({
  letter: z.string().refine(isLetter, OPTIONS_MESSAGE),
  text: z
    .string()
    .trim()
    .min(1, 'Informe o texto da alternativa.')
    .max(1000, 'A alternativa deve ter no máximo 1000 caracteres.'),
});

export const questionSchema = z.object({
  subject_id: z.string().min(1, 'Escolha a disciplina.'),
  category_id: z.string().min(1, 'Escolha a categoria.'),
  difficulty: z.string().refine(isDifficulty, 'Escolha a dificuldade.'),
  statement: z
    .string()
    .trim()
    .min(1, 'Informe o enunciado.')
    .min(10, 'O enunciado deve ter pelo menos 10 caracteres.')
    .max(5000, 'O enunciado deve ter no máximo 5000 caracteres.'),
  explanation: z
    .string()
    .trim()
    .min(1, 'Informe a explicação.')
    .max(5000, 'A explicação deve ter no máximo 5000 caracteres.'),
  options: z.array(optionSchema).length(OPTION_LETTERS.length, OPTIONS_MESSAGE),
  correct_letter: z.string().refine(isLetter, 'Escolha a alternativa correta.'),
});

/** Valores digitados no formulário (selects entregam ids como texto; '' = nada escolhido). */
export type QuestionFormValues = z.input<typeof questionSchema>;
export type QuestionFormOutput = z.output<typeof questionSchema>;

/** Corpo de `POST /questions` e `PUT /questions/:id` a partir dos valores já validados. */
export function toQuestionPayload(values: QuestionFormOutput): QuestionPayload {
  return {
    subject_id: Number(values.subject_id),
    category_id: Number(values.category_id),
    statement: values.statement,
    difficulty: values.difficulty as Difficulty,
    explanation: values.explanation,
    options: values.options.map((option) => ({ letter: option.letter as OptionLetter, text: option.text })),
    correct_letter: values.correct_letter as OptionLetter,
  };
}
