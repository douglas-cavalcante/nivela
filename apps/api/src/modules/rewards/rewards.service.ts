import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApiImageUpload,
  ApiList,
  ApiReward,
  ApiStoreReward,
  Paginated,
} from '@nivela/api-contract';
import { Prisma } from 'src/generated/prisma/client';
import { ListRewardsQuery } from 'src/modules/rewards/dto/list-rewards.query';
import { RewardDto } from 'src/modules/rewards/dto/reward.dto';
import {
  presentReward,
  presentStoreReward,
} from 'src/modules/rewards/presenters/reward.presenter';
import { RewardImageService } from 'src/modules/rewards/reward-image.service';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AuthUser } from 'src/shared/auth/auth-user';
import { Role } from 'src/shared/enums/role.enum';
import type { UploadedImage } from 'src/shared/files/image-storage.service';
import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';
import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';
import { studentScope } from 'src/shared/scopes/student-scope';

const NOT_FOUND = 'Prêmio não encontrado.';
const FORBIDDEN =
  'Só quem cadastrou ou um administrador pode editar este prêmio.';

/** Os resgates pendentes contados são só os de alunos no escopo de quem consulta (RN15). */
const withRelations = (user: AuthUser) =>
  ({
    creator: { select: { id: true, name: true } },
    _count: {
      select: {
        redemptions: {
          where: { status: 'pending' as const, student: studentScope(user) },
        },
      },
    },
  }) satisfies Prisma.RewardInclude;

type RewardRecord = Prisma.RewardGetPayload<{
  include: ReturnType<typeof withRelations>;
}>;

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: RewardImageService,
  ) {}

  async list(
    query: ListRewardsQuery,
    user: AuthUser,
  ): Promise<Paginated<ApiReward>> {
    const where: Prisma.RewardWhereInput = {
      ...(query.status ? { active: query.status === 'active' } : {}),
      ...(query.search ? { name: containsInsensitive(query.search) } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: withRelations(user),
        ...toPrismaPage(query),
      }),
      this.prisma.reward.count({ where }),
    ]);
    return paginate(
      rows.map((row) => this.present(row, user)),
      total,
      query,
    );
  }

  async findOne(id: number, user: AuthUser): Promise<ApiReward> {
    return this.present(await this.load(id, user), user);
  }

  async create(dto: RewardDto, user: AuthUser): Promise<ApiReward> {
    const reward = await this.prisma.reward.create({
      data: {
        createdBy: user.id,
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        stock: dto.stock,
      },
      select: { id: true },
    });
    return this.present(await this.load(reward.id, user), user);
  }

  async update(id: number, dto: RewardDto, user: AuthUser): Promise<ApiReward> {
    this.assertCanEdit(await this.load(id, user), user);
    // O estoque é gravado como valor absoluto; o `FOR UPDATE` na linha do
    // prêmio serializa esta edição com resgate e recusa (que alteram o
    // estoque com o prêmio travado), então nenhuma baixa ou devolução se perde.
    // Aqui não há moedas: o prêmio é o único lock da transação.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "rewards" WHERE "id" = ${id} FOR UPDATE`;
      await tx.reward.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          price: dto.price,
          stock: dto.stock,
        },
        select: { id: true },
      });
    });
    return this.present(await this.load(id, user), user);
  }

  async setStatus(
    id: number,
    active: boolean,
    user: AuthUser,
  ): Promise<ApiReward> {
    this.assertCanEdit(await this.load(id, user), user);
    await this.prisma.reward.update({
      where: { id },
      data: { active },
      select: { id: true },
    });
    return this.present(await this.load(id, user), user);
  }

  /** Valida o arquivo, grava o novo, aponta o prêmio para ele e só então apaga o antigo. */
  async replaceImage(
    id: number,
    file: UploadedImage | undefined,
    user: AuthUser,
  ): Promise<ApiImageUpload> {
    const reward = await this.load(id, user);
    this.assertCanEdit(reward, user);
    this.images.validate(file);

    const imagePath = await this.images.save(
      id,
      (file as UploadedImage).buffer,
    );
    try {
      await this.prisma.reward.update({
        where: { id },
        data: { imagePath },
        select: { id: true },
      });
    } catch (error) {
      await this.images.remove(imagePath);
      throw error;
    }
    await this.images.remove(reward.imagePath);
    return { image_url: this.images.urlFor(imagePath) as string };
  }

  async removeImage(id: number, user: AuthUser): Promise<void> {
    const reward = await this.load(id, user);
    this.assertCanEdit(reward, user);
    if (!reward.imagePath) {
      return;
    }
    await this.prisma.reward.update({
      where: { id },
      data: { imagePath: null },
      select: { id: true },
    });
    await this.images.remove(reward.imagePath);
  }

  /** Vitrine do aluno: só prêmios ativos, do mais barato ao mais caro. */
  async storeList(user: AuthUser): Promise<ApiList<ApiStoreReward>> {
    const [profile, rows] = await Promise.all([
      this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        select: { coinsBalance: true },
      }),
      this.prisma.reward.findMany({
        where: { active: true },
        orderBy: [{ price: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const balance = profile?.coinsBalance ?? 0;
    return {
      data: rows.map((row) =>
        presentStoreReward(row, this.images.urlFor(row.imagePath), balance),
      ),
    };
  }

  private async load(id: number, user: AuthUser): Promise<RewardRecord> {
    const reward = await this.prisma.reward.findUnique({
      where: { id },
      include: withRelations(user),
    });
    if (!reward) {
      throw new NotFoundException(NOT_FOUND);
    }
    return reward;
  }

  private canEdit(reward: { createdBy: number }, user: AuthUser): boolean {
    return user.role === Role.Admin || reward.createdBy === user.id;
  }

  private assertCanEdit(reward: { createdBy: number }, user: AuthUser): void {
    if (!this.canEdit(reward, user)) {
      throw new ForbiddenException(FORBIDDEN);
    }
  }

  private present(row: RewardRecord, user: AuthUser): ApiReward {
    return presentReward(
      row,
      this.images.urlFor(row.imagePath),
      this.canEdit(row, user),
    );
  }
}
