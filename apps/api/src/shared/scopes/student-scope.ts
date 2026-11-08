import type { Prisma } from 'src/generated/prisma/client';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { classroomScope } from 'src/shared/scopes/classroom-scope';

/**
 * Visibilidade de alunos (RN15): o administrador enxerga todos (inclusive os
 * sem turma); o professor, só os matriculados em turmas dele. `classroomId`
 * restringe a uma turma, sempre dentro do que o usuário já pode ver (a turma
 * de outro professor não mostra ninguém).
 */
export function studentScope(
  user: AuthUser,
  classroomId?: number,
): Prisma.UserWhereInput {
  const unrestricted = user.role === Role.Admin && classroomId === undefined;
  return {
    role: Role.Student,
    ...(unrestricted
      ? {}
      : {
          enrollments: {
            some: {
              ...(classroomId === undefined ? {} : { classroomId }),
              classroom: classroomScope(user),
            },
          },
        }),
  };
}
