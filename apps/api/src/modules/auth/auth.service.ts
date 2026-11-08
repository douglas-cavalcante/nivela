import { ForbiddenException, Injectable } from '@nestjs/common';
import { compare, hash, hashSync } from 'bcryptjs';
import { ChangePasswordDto } from 'src/modules/auth/dto/change-password.dto';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { RegisterStudentDto } from 'src/modules/auth/dto/register-student.dto';
import { presentUser } from 'src/modules/auth/presenters/user.presenter';
import { TokenService } from 'src/modules/auth/token.service';
import { ClassroomsService } from 'src/modules/classrooms/classrooms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { ApiUser } from '@nivela/api-contract';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import { isUniqueViolation } from 'src/shared/prisma/unique-violation';
import { BCRYPT_COST } from 'src/shared/security/password';

// Hash de uma senha qualquer, comparado quando o e-mail não existe para que o
// tempo de resposta não revele se o e-mail está cadastrado.
const DUMMY_HASH = hashSync('nivela-dummy', BCRYPT_COST);

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';
const EMAIL_TAKEN = 'Este e-mail já está cadastrado.';
// Restrição única do e-mail em `users` (nome gerado pela migration).
const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';

export interface AuthResult {
  token: string;
  user: ApiUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly classrooms: ClassroomsService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const passwordOk = await compare(
      dto.password,
      user?.password ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      throw new FieldValidationException({ email: [INVALID_CREDENTIALS] });
    }
    if (!user.active) {
      throw new ForbiddenException('Usuário desativado.');
    }
    if (user.role === Role.Student && dto.channel === 'web') {
      throw new ForbiddenException('Alunos acessam pelo aplicativo Nivela.');
    }
    if (user.role !== Role.Student && dto.channel === 'mobile') {
      throw new ForbiddenException(
        'Professores e administradores acessam pelo painel web.',
      );
    }

    const token = await this.tokens.issue(user.id, dto.channel);
    return { token, user: presentUser(user) };
  }

  async registerStudent(dto: RegisterStudentDto): Promise<AuthResult> {
    const passwordHash = await hash(dto.password, BCRYPT_COST);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // O código da turma é checado primeiro: sem um código válido, a
        // resposta não diz se o e-mail já existe (evita descobrir e-mails).
        const classroom = await this.classrooms.findJoinable(dto.join_code, tx);

        const emailTaken = await tx.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        });
        if (emailTaken) {
          throw new FieldValidationException({ email: [EMAIL_TAKEN] });
        }

        const user = await tx.user.create({
          data: {
            name: dto.name.trim(),
            email: dto.email,
            password: passwordHash,
            role: Role.Student,
          },
        });
        await tx.studentProfile.create({ data: { userId: user.id } });
        await tx.classroomStudent.create({
          data: { classroomId: classroom.id, studentId: user.id },
        });

        const token = await this.tokens.issue(user.id, 'mobile', tx);
        return { token, user: presentUser(user) };
      });
    } catch (error) {
      // Cadastros simultâneos com o mesmo e-mail: a unicidade do banco decide.
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new FieldValidationException({ email: [EMAIL_TAKEN] });
      }
      throw error;
    }
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    currentToken?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await compare(dto.current_password, user.password))) {
      throw new FieldValidationException({
        current_password: ['A senha atual está incorreta.'],
      });
    }

    const passwordHash = await hash(dto.password, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      });
      // Encerra as outras sessões; a atual continua valendo.
      await this.tokens.revokeOthers(userId, currentToken, tx);
    });
  }
}
