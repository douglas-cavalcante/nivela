import { subjectColorKeys, subjectIconKeys } from '@nivela/design-tokens';
import type { SubjectColorKey, SubjectIconKey } from '@nivela/design-tokens';
import { z } from 'zod';

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da disciplina.')
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome deve ter no máximo 60 caracteres.'),
  color: z.enum(subjectColorKeys as [SubjectColorKey, ...SubjectColorKey[]], { error: 'Escolha uma cor válida.' }),
  icon: z.enum(subjectIconKeys as [SubjectIconKey, ...SubjectIconKey[]], { error: 'Escolha um ícone válido.' }),
});

export type SubjectFormValues = z.infer<typeof subjectSchema>;
