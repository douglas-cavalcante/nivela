import { Prisma } from 'src/generated/prisma/client';
import { JoinCodeService } from 'src/modules/classrooms/join-code.service';
import { PrismaService } from 'src/prisma/prisma.service';

const CODE = /^NIV-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

function collision(constraint = 'classrooms_join_code_key') {
  return new Prisma.PrismaClientKnownRequestError('duplicado', {
    code: 'P2002',
    clientVersion: 'teste',
    meta: {
      modelName: 'Classroom',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          kind: 'UniqueConstraintViolation',
          constraint: { index: constraint },
          table: 'classrooms',
        },
      },
    },
  });
}

describe('JoinCodeService', () => {
  const create = jest.fn();
  const update = jest.fn();
  const service = new JoinCodeService({
    classroom: { create, update },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('gera no formato NIV-XXXX sem caracteres ambíguos', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(JoinCodeService.randomCode()).toMatch(CODE);
    }
  });

  it.each([
    [' niv-4k7q ', 'NIV-4K7Q'],
    [' niv 4k7q ', 'NIV-4K7Q'],
    ['niv4k7q', 'NIV-4K7Q'],
    ['NIV-4K7Q', 'NIV-4K7Q'],
    ['n i v - 4 k 7 q', 'NIV-4K7Q'],
    ['\tniv\n4k7q', 'NIV-4K7Q'],
  ])('normaliza %j em %j', (raw, expected) => {
    expect(JoinCodeService.normalize(raw)).toBe(expected);
  });

  describe('createWithUniqueCode', () => {
    it('grava a turma com um código gerado', async () => {
      create.mockImplementation(({ data }: { data: { joinCode: string } }) =>
        Promise.resolve({ id: 1, ...data }),
      );

      const classroom = await service.createWithUniqueCode({
        teacherId: 3,
        name: '9º A',
      });

      expect(classroom.joinCode).toMatch(CODE);
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: { teacherId: 3, name: '9º A', joinCode: classroom.joinCode },
      });
    });

    it('tenta de novo quando o código colide (P2002) e grava na terceira tentativa', async () => {
      create
        .mockRejectedValueOnce(collision())
        .mockRejectedValueOnce(collision())
        .mockResolvedValueOnce({ id: 1, joinCode: 'NIV-OK23' });

      const classroom = await service.createWithUniqueCode({
        teacherId: 3,
        name: '9º A',
      });

      expect(classroom).toEqual({ id: 1, joinCode: 'NIV-OK23' });
      expect(create).toHaveBeenCalledTimes(3);
      const codes = create.mock.calls.map(
        ([arg]: [{ data: { joinCode: string } }]) => arg.data.joinCode,
      );
      codes.forEach((code: string) => expect(code).toMatch(CODE));
    });

    it('desiste depois de 10 colisões', async () => {
      create.mockRejectedValue(collision());

      await expect(
        service.createWithUniqueCode({ teacherId: 3, name: '9º A' }),
      ).rejects.toThrow('Não foi possível gerar um código de turma único.');
      expect(create).toHaveBeenCalledTimes(10);
    });

    it('não engole outros erros nem outras colisões', async () => {
      const other = collision('users_email_key');
      create.mockRejectedValueOnce(other);

      await expect(
        service.createWithUniqueCode({ teacherId: 3, name: '9º A' }),
      ).rejects.toBe(other);
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('regenerate', () => {
    it('troca o código da turma e devolve o novo', async () => {
      update.mockImplementation(({ data }: { data: { joinCode: string } }) =>
        Promise.resolve({ id: 5, joinCode: data.joinCode }),
      );

      const code = await service.regenerate(5, { teacherId: 3 });

      expect(code).toMatch(CODE);
      expect(update).toHaveBeenCalledWith({
        where: { id: 5, AND: [{ teacherId: 3 }] },
        data: { joinCode: code },
        select: { joinCode: true },
      });
    });

    it('tenta de novo quando o código colide', async () => {
      update
        .mockRejectedValueOnce(collision())
        .mockResolvedValueOnce({ joinCode: 'NIV-OK23' });

      await expect(service.regenerate(5, { teacherId: 3 })).resolves.toBe(
        'NIV-OK23',
      );
      expect(update).toHaveBeenCalledTimes(2);
    });

    it('desiste depois de 10 colisões', async () => {
      update.mockRejectedValue(collision());

      await expect(service.regenerate(5, { teacherId: 3 })).rejects.toThrow(
        'Não foi possível gerar um código de turma único.',
      );
      expect(update).toHaveBeenCalledTimes(10);
    });
  });
});
