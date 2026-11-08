import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe seu e-mail').pipe(z.email('Informe um e-mail válido.')),
  password: z.string().min(1, 'Informe sua senha'),
});

export type LoginFormValues = z.input<typeof loginSchema>;
export type LoginPayloadValues = z.output<typeof loginSchema>;
