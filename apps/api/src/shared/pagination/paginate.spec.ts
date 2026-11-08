import { paginate, toPrismaPage } from 'src/shared/pagination/paginate';

describe('toPrismaPage', () => {
  it('usa página 1 e 15 por página por padrão', () => {
    expect(toPrismaPage({})).toEqual({ skip: 0, take: 15 });
  });

  it('calcula o deslocamento da página pedida', () => {
    expect(toPrismaPage({ page: 3, per_page: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });
});

describe('paginate', () => {
  it('monta { data, meta } em snake_case', () => {
    expect(paginate(['a', 'b'], 32, { page: 2, per_page: 15 })).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, per_page: 15, total: 32, last_page: 3 },
    });
  });

  it('usa os padrões quando a query vem vazia', () => {
    expect(paginate([], 15, {}).meta).toEqual({
      page: 1,
      per_page: 15,
      total: 15,
      last_page: 1,
    });
  });

  it('sem registros, last_page é 1', () => {
    expect(paginate([], 0, { page: 1, per_page: 15 }).meta.last_page).toBe(1);
  });
});
