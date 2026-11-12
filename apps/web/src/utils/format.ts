/** Data no formato brasileiro (dd/mm/aaaa) a partir de um ISO da API. */
export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('pt-BR');

/** Dia no formato brasileiro (dd/mm/aaaa) a partir de `AAAA-MM-DD`, sem passar por fuso horário. */
export const formatDay = (day: string): string => {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};

/** Data e hora no formato brasileiro (dd/mm/aaaa hh:mm), no fuso do navegador, a partir de um ISO da API. */
export const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
