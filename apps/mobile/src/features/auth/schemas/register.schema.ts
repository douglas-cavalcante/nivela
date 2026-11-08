import { z } from 'zod';

export const registerSchema = z
  .object({
    join_code: z.string().trim().min(1, 'Informe o código da turma').transform((code) => code.toUpperCase()),
    name: z.string().trim().min(1, 'Informe seu nome'),
    email: z.string().trim().toLowerCase().min(1, 'Informe seu e-mail').pipe(z.email('Informe um e-mail válido.')),
    password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
    password_confirmation: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'As senhas não conferem',
  });

export type RegisterFormValues = z.input<typeof registerSchema>;
export type RegisterPayloadValues = z.output<typeof registerSchema>;
