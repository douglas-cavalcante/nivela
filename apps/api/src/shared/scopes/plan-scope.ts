import type { Prisma } from 'src/generated/prisma/client';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';

/**
 * Visibilidade de planos (RN15): o administrador enxerga todos; o professor,
 * só os próprios. Qualquer outro perfil não enxerga nenhum. Toda consulta e
 * escrita de planos, capítulos, atribuições e progresso parte deste filtro.
 */
export function planScope(user: AuthUser): Prisma.LevelingPlanWhereInput {
  switch (user.role) {
    case Role.Admin:
      return {};
    case Role.Teacher:
      return { teacherId: user.id };
    default:
      return { id: { in: [] } };
  }
}
