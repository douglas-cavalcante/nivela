import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RewardDto } from 'src/modules/rewards/dto/reward.dto';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const author: AuthUser = {
  id: 1,
  name: 'Autora',
  email: 'a@nivela.test',
  role: Role.Teacher,
};
const stranger: AuthUser = { ...author, id: 2 };
const admin: AuthUser = { ...author, id: 3, role: Role.Admin };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 10,
  createdBy: 1,
  name: 'Caderno',
  description: null,
  imagePath: null,
  price: 50,
  stock: 3,
  active: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  creator: { id: 1, name: 'Autora' },
  _count: { redemptions: 0 },
  ...overrides,
});

const dto: RewardDto = { name: 'Caderno', price: 50, stock: 3 };

describe('RewardsService', () => {
  const rewardFindUnique = jest.fn();
  const rewardFindMany = jest.fn();
  const rewardUpdate = jest.fn();
  const profileFindUnique = jest.fn();
  // Ordem das chamadas dentro da transação do `update` (trava antes da gravação).
  const txOrder: string[] = [];
  const txQueryRaw = jest.fn((strings: TemplateStringsArray) => {
    txOrder.push(strings.join('?').includes('FOR UPDATE') ? 'lock' : 'raw');
    return Promise.resolve([{ id: 10 }]);
  });
  const txRewardUpdate = jest.fn(() => {
    txOrder.push('update');
    return Promise.resolve({});
  });
  const images = {
    validate: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    urlFor: jest.fn((path: string | null) =>
      path ? `/uploads/${path}` : null,
    ),
  };
  const service = new RewardsService(
    {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ $queryRaw: txQueryRaw, reward: { update: txRewardUpdate } }),
      ),
      reward: {
        findUnique: rewardFindUnique,
        findMany: rewardFindMany,
        update: rewardUpdate,
      },
      studentProfile: { findUnique: profileFindUnique },
    } as unknown as PrismaService,
    images as unknown as RewardImageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    txOrder.length = 0;
  });

  it('findOne: 404 "Prêmio não encontrado." e can_edit por autoria ou administrador', async () => {
    rewardFindUnique.mockResolvedValueOnce(null);
    await expect(service.findOne(10, author)).rejects.toThrow(
      new NotFoundException('Prêmio não encontrado.'),
    );

    rewardFindUnique.mockResolvedValue(row());
    expect((await service.findOne(10, author)).can_edit).toBe(true);
    expect((await service.findOne(10, admin)).can_edit).toBe(true);
    expect((await service.findOne(10, stranger)).can_edit).toBe(false);
  });

  it('update e setStatus: quem não criou (e não é admin) leva 403 sem gravar', async () => {
    rewardFindUnique.mockResolvedValue(row());
    await expect(service.update(10, dto, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.setStatus(10, false, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rewardUpdate).not.toHaveBeenCalled();
  });

  it('update sem descrição grava null', async () => {
    rewardFindUnique.mockResolvedValue(row());
    await service.update(10, dto, admin);
    expect(txRewardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Caderno', description: null, price: 50, stock: 3 },
      }),
    );
  });

  it('update: trava o prêmio (FOR UPDATE) antes de gravar o estoque absoluto, para serializar com resgate e recusa', async () => {
    rewardFindUnique.mockResolvedValue(row());
    await service.update(10, { ...dto, stock: 8 }, author);
    expect(txOrder).toEqual(['lock', 'update']);
    expect(txRewardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: 8 }) as unknown,
      }),
    );
  });

  it('replaceImage: grava, aponta e só então apaga a antiga', async () => {
    rewardFindUnique.mockResolvedValue(row({ imagePath: 'rewards/old.png' }));
    images.save.mockResolvedValue('rewards/new.png');
    rewardUpdate.mockResolvedValue({});

    const result = await service.replaceImage(10, { buffer: PNG }, author);

    expect(result).toEqual({ image_url: '/uploads/rewards/new.png' });
    expect(images.remove).toHaveBeenCalledWith('rewards/old.png');
    expect(images.remove).not.toHaveBeenCalledWith('rewards/new.png');
  });

  it('replaceImage: arquivo inválido não grava; 403 vem antes de olhar o arquivo', async () => {
    rewardFindUnique.mockResolvedValue(row());
    images.validate.mockImplementation(() => {
      throw new FieldValidationException({ image: ['Envie uma imagem.'] });
    });
    await expect(
      service.replaceImage(10, undefined, author),
    ).rejects.toBeInstanceOf(FieldValidationException);
    expect(images.save).not.toHaveBeenCalled();

    images.validate.mockClear();
    await expect(
      service.replaceImage(10, { buffer: PNG }, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(images.validate).not.toHaveBeenCalled();
  });

  it('replaceImage: se o banco falha, apaga o arquivo novo e mantém o antigo', async () => {
    rewardFindUnique.mockResolvedValue(row({ imagePath: 'rewards/old.png' }));
    images.validate.mockReturnValue('png');
    images.save.mockResolvedValue('rewards/new.png');
    rewardUpdate.mockRejectedValue(new Error('banco fora do ar'));

    await expect(
      service.replaceImage(10, { buffer: PNG }, author),
    ).rejects.toThrow('banco fora do ar');
    expect(images.remove).toHaveBeenCalledTimes(1);
    expect(images.remove).toHaveBeenCalledWith('rewards/new.png');
  });

  it('removeImage: sem imagem não toca no banco', async () => {
    rewardFindUnique.mockResolvedValue(row());
    await service.removeImage(10, author);
    expect(rewardUpdate).not.toHaveBeenCalled();
    expect(images.remove).not.toHaveBeenCalled();
  });

  it('storeList: affordable compara o saldo com o preço (saldo igual ao preço pode)', async () => {
    profileFindUnique.mockResolvedValue({ coinsBalance: 50 });
    rewardFindMany.mockResolvedValue([
      row({ id: 1, price: 50 }),
      row({ id: 2, price: 51 }),
    ]);
    const result = await service.storeList(author);
    expect(result.data.map((r) => r.affordable)).toEqual([true, false]);
    expect(rewardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });
});
