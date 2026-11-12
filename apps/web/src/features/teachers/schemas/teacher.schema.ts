import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Informe o nome do professor.')
  .min(2, 'O nome deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome deve ter no máximo 120 caracteres.');

const email = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail.')
  .max(190, 'O e-mail deve ter no máximo 190 caracteres.')
  .pipe(z.email('Informe um e-mail válido.'));

const password = z
  .string()
  .min(1, 'Informe a senha.')
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.');

export const updateTeacherSchema = z.object({ name, email });
export const createTeacherSchema = updateTeacherSchema.extend({ password });
export const teacherPasswordSchema = z
  .object({
    password,
    password_confirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'A confirmação de senha não confere.',
  });

/** Valores do formulário; `password` só existe na criação. */
export interface TeacherFormValues {
  name: string;
  email: string;
  password?: string;
}
export type CreateTeacherValues = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherValues = z.infer<typeof updateTeacherSchema>;
export type TeacherPasswordValues = z.infer<typeof teacherPasswordSchema>;
