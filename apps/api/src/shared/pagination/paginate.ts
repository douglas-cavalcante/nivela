import type { Paginated, PaginationMeta } from '@nivela/api-contract';
import type { PaginationQueryDto } from 'src/shared/pagination/pagination-query.dto';

export const DEFAULT_PER_PAGE = 15;
export const MAX_PER_PAGE = 100;

export type { Paginated, PaginationMeta };

function resolve(query: PaginationQueryDto): { page: number; perPage: number } {
  return { page: query.page ?? 1, perPage: query.per_page ?? DEFAULT_PER_PAGE };
}

/** `skip`/`take` do Prisma para a página pedida. */
export function toPrismaPage(query: PaginationQueryDto): {
  skip: number;
  take: number;
} {
  const { page, perPage } = resolve(query);
  return { skip: (page - 1) * perPage, take: perPage };
}

/** Monta `{ data, meta }` a partir da página lida e do total de registros. */
export function paginate<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> {
  const { page, perPage } = resolve(query);
  return {
    data,
    meta: {
      page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
