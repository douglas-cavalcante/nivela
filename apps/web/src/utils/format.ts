/** Data no formato brasileiro (dd/mm/aaaa) a partir de um ISO da API. */
export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('pt-BR');
