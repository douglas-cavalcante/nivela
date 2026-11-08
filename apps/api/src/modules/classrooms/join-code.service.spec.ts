import { JoinCodeService } from 'src/modules/classrooms/join-code.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('JoinCodeService', () => {
  const makeService = (findUnique: jest.Mock) =>
    new JoinCodeService({
      classroom: { findUnique },
    } as unknown as PrismaService);

  it('gera no formato NIV-XXXX sem caracteres ambíguos', async () => {
    const service = makeService(jest.fn().mockResolvedValue(null));

    for (let i = 0; i < 50; i += 1) {
      expect(await service.generate()).toMatch(
        /^NIV-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/,
      );
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

  it('tenta de novo se o código já existe', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null);
    const service = makeService(findUnique);

    const code = await service.generate();

    expect(code).toMatch(/^NIV-/);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('desiste depois de muitas colisões', async () => {
    const service = makeService(jest.fn().mockResolvedValue({ id: 1 }));

    await expect(service.generate()).rejects.toThrow();
  });
});
