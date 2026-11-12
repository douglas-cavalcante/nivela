/** Maior valor de uma coluna INTEGER do PostgreSQL (limite dos ids da API). */
export const MAX_ID = 2_147_483_647;

/** Devolve o id (texto) se for um inteiro positivo aceito pela API; senão, ''. */
export const validId = (value: string | undefined): string =>
  value !== undefined && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= MAX_ID ? value : '';
