import { z } from 'zod';

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Informe sua senha atual.'),
    password: z.string().min(8, 'A nova senha precisa ter ao menos 8 caracteres.'),
    password_confirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'A confirmação de senha não confere.',
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
