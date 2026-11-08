import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createUser, DEFAULT_PASSWORD } from './factories';

/** Cria um usuário com o perfil e devolve o token de uma sessão aberta. */
export async function tokenFor(
  app: INestApplication,
  role: Role,
): Promise<string> {
  const user = await createUser(app.get(PrismaService), { role });
  const { body } = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({
      email: user.email,
      password: DEFAULT_PASSWORD,
      channel: role === Role.Student ? 'mobile' : 'web',
    })
    .expect(200);
  return body.token as string;
}
