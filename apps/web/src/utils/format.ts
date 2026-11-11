/** Data no formato brasileiro (dd/mm/aaaa) a partir de um ISO da API. */
export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('pt-BR');

/** Dia no formato brasileiro (dd/mm/aaaa) a partir de `AAAA-MM-DD`, sem passar por fuso horário. */
export const formatDay = (day: string): string => {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};
