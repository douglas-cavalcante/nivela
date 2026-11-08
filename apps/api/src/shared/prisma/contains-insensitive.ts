/**
 * Filtro Prisma de busca parcial sem diferenciar maiúsculas.
 *
 * O Prisma 7 repassa `contains` ao `ILIKE` sem escapar os curingas (verificado
 * na prática: "joao_" casa "joaoxsilva" e "%" casa tudo). O PostgreSQL usa a
 * barra invertida como escape padrão do `LIKE`, então `\`, `%` e `_` digitados
 * pela pessoa são escapados para valerem como texto literal.
 */
export function containsInsensitive(term: string): {
  contains: string;
  mode: 'insensitive';
} {
  return {
    contains: term.replace(/[\\%_]/g, (char) => `\\${char}`),
    mode: 'insensitive',
  };
}
