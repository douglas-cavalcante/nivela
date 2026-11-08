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

  it('normaliza', () => {
    expect(JoinCodeService.normalize(' niv-4k7q ')).toBe('NIV-4K7Q');
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
