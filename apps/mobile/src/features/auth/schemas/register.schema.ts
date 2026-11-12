import { z } from 'zod';
import { normalizeJoinCode } from 'src/features/classrooms';

export const registerSchema = z
  .object({
    join_code: z.string().trim().min(1, 'Informe o código da turma.').transform(normalizeJoinCode),
    name: z.string().trim().min(1, 'Informe seu nome.'),
    email: z.string().trim().toLowerCase().min(1, 'Informe seu e-mail.').pipe(z.email('Informe um e-mail válido.')),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
    password_confirmation: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'A confirmação de senha não confere.',
  });

export type RegisterFormValues = z.input<typeof registerSchema>;
export type RegisterPayloadValues = z.output<typeof registerSchema>;
