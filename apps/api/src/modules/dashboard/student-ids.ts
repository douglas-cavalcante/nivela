import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { studentScope } from 'src/shared/scopes/student-scope';

/** Ids dos alunos que o usuário pode ver (RN15); base de toda agregação em SQL. */
export async function scopedStudentIds(
  prisma: PrismaService,
  user: AuthUser,
  classroomId?: number,
): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: studentScope(user, classroomId),
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
