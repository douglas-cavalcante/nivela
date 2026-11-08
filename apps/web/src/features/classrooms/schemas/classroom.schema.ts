import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Informe o nome da turma.')
  .min(2, 'O nome deve ter pelo menos 2 caracteres.')
  .max(120, 'O nome deve ter no máximo 120 caracteres.');

const schoolYear = z.string().trim().max(40, 'O ano letivo deve ter no máximo 40 caracteres.');

export const classroomSchema = z.object({ name, school_year: schoolYear, teacher_id: z.string(), active: z.boolean() });
/** Administrador criando: precisa escolher o professor. */
export const adminClassroomSchema = classroomSchema.extend({
  teacher_id: z.string().min(1, 'Informe o professor da turma.'),
});

export interface ClassroomFormValues {
  name: string;
  school_year: string;
  /** Id do professor (texto do select); só o administrador, só na criação. */
  teacher_id: string;
  /** Só na edição. */
  active: boolean;
}

export interface ClassroomPayload {
  name: string;
  school_year: string | null;
  teacher_id?: number;
  active?: boolean;
}

export const addStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome do aluno.')
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail.')
    .max(190, 'O e-mail deve ter no máximo 190 caracteres.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string()
    .min(1, 'Informe a senha.')
    .min(8, 'A senha deve ter pelo menos 8 caracteres.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.'),
});

export type AddStudentValues = z.infer<typeof addStudentSchema>;
