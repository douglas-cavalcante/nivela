/** Corpo de toda resposta de erro da API. `errors` só vem nos 422, por campo (snake_case). */
export interface ErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}

/** Erro de requisição já normalizado para exibição. */
export interface ApiErrorInfo {
  /** Status HTTP; `null` quando nem chegou resposta (API fora do ar, sem rede). */
  status: number | null;
  /** Mensagem principal em português, pronta para exibir. */
  message: string;
  /** Erros de validação (422) por campo, com os nomes que a API usa (snake_case). */
  fieldErrors: Record<string, string[]>;
}
