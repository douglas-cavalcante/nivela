import type { Prisma } from 'src/generated/prisma/client';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/**
 * Visibilidade de turmas (RN15): o administrador enxerga todas; o professor,
 * só as próprias. Qualquer outro perfil não enxerga nenhuma. Toda consulta de
 * turma da equipe parte deste filtro, para que nenhuma rota esqueça a regra.
 */
export function classroomScope(user: AuthUser): Prisma.ClassroomWhereInput {
  switch (user.role) {
    case Role.Admin:
      return {};
    case Role.Teacher:
      return { teacherId: user.id };
    default:
      return { id: { in: [] } };
  }
}
