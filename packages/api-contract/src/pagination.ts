export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** Formato de toda listagem paginada da API. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
