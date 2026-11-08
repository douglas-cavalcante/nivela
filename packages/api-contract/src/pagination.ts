export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** Listagem sem paginação (ex.: `GET /subjects`, `GET /me/classrooms`). */
export interface ApiList<T> {
  data: T[];
}

/** Formato de toda listagem paginada da API. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
