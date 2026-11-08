import { ForbiddenException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { Prisma } from 'src/generated/prisma/client';
import { AuthService } from 'src/modules/auth/auth.service';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { RegisterStudentDto } from 'src/modules/auth/dto/register-student.dto';
import { TokenService } from 'src/modules/auth/token.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const PASSWORD = 'segredo123';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Ana',
    email: 'ana@escola.com',
    password: hashSync(PASSWORD, 4),
    role: 'teacher',
    active: true,
    ...overrides,
  };
}

describe('AuthService', () => {
  const findUnique = jest.fn();
  const transaction = jest.fn();
  const issue = jest.fn();
  const prisma = {
    user: { findUnique },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new AuthService(prisma, {
    issue,
  } as unknown as TokenService);

  const loginDto = (overrides: Partial<LoginDto> = {}): LoginDto => ({
    email: 'ana@escola.com',
    password: PASSWORD,
    channel: 'web',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    issue.mockResolvedValue('token-puro');
  });

  describe('login', () => {
    it('devolve token e usuário sem a senha', async () => {
      findUnique.mockResolvedValue(makeUser());

      const result = await service.login(loginDto());

      expect(result).toEqual({
        token: 'token-puro',
        user: { id: 7, name: 'Ana', email: 'ana@escola.com', role: 'teacher' },
      });
      expect(issue).toHaveBeenCalledWith(7, 'web');
    });

    it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
      findUnique.mockResolvedValueOnce(null);
      const missing = await service.login(loginDto()).catch((e: unknown) => e);

      findUnique.mockResolvedValueOnce(makeUser());
      const wrong = await service
        .login(loginDto({ password: 'outra-senha' }))
        .catch((e: unknown) => e);

      expect(missing).toBeInstanceOf(FieldValidationException);
      expect(wrong).toBeInstanceOf(FieldValidationException);
      expect((missing as FieldValidationException).getResponse()).toEqual(
        (wrong as FieldValidationException).getResponse(),
      );
      expect(issue).not.toHaveBeenCalled();
    });

    it('só revela que o usuário está desativado depois de validar a senha', async () => {
      findUnique.mockResolvedValue(makeUser({ active: false }));

      await expect(
        service.login(loginDto({ password: 'errada-errada' })),
      ).rejects.toBeInstanceOf(FieldValidationException);
      await expect(service.login(loginDto())).rejects.toThrow(
        'Usuário desativado.',
      );
    });

    it('aplica a regra de canal por perfil', async () => {
      findUnique.mockResolvedValue(makeUser({ role: 'student' }));
      await expect(service.login(loginDto())).rejects.toThrow(
        new ForbiddenException('Alunos acessam pelo aplicativo Nivela.'),
      );

      findUnique.mockResolvedValue(makeUser({ role: 'admin' }));
      await expect(
        service.login(loginDto({ channel: 'mobile' })),
      ).rejects.toThrow(
        'Professores e administradores acessam pelo painel web.',
      );
    });
  });

  describe('registerStudent', () => {
    const dto: RegisterStudentDto = {
      name: 'Bia',
      email: 'bia@aluno.com',
      password: PASSWORD,
      password_confirmation: PASSWORD,
      join_code: 'NIV-4K7Q',
    };

    it('traduz a violação de unicidade do banco em erro de e-mail duplicado', async () => {
      transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicado', {
          code: 'P2002',
          clientVersion: 'teste',
          meta: { modelName: 'User', target: ['email'] },
        }),
      );

      const error = await service.registerStudent(dto).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(FieldValidationException);
      expect((error as FieldValidationException).getResponse()).toMatchObject({
        errors: { email: ['Este e-mail já está cadastrado.'] },
      });
    });

    it('não mapeia violação de unicidade de outra restrição', async () => {
      const failure = new Prisma.PrismaClientKnownRequestError('duplicado', {
        code: 'P2002',
        clientVersion: 'teste',
        meta: { modelName: 'AccessToken', target: ['token_hash'] },
      });
      transaction.mockRejectedValue(failure);

      await expect(service.registerStudent(dto)).rejects.toBe(failure);
    });

    it('propaga outros erros sem alterá-los', async () => {
      const failure = new Error('banco fora do ar');
      transaction.mockRejectedValue(failure);

      await expect(service.registerStudent(dto)).rejects.toBe(failure);
    });
  });
});
