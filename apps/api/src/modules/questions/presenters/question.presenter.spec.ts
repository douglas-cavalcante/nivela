import { statementExcerpt } from 'src/modules/questions/presenters/question.presenter';

describe('statementExcerpt', () => {
  it('mantém enunciados curtos como estão', () => {
    expect(statementExcerpt('Quanto é 2 + 2?')).toBe('Quanto é 2 + 2?');
  });

  it('troca quebras de linha por espaço', () => {
    expect(statementExcerpt('Linha 1\nLinha 2\r\n\r\nLinha 3')).toBe(
      'Linha 1 Linha 2 Linha 3',
    );
  });

  it('corta em 140 caracteres e acrescenta reticências', () => {
    const excerpt = statementExcerpt('a'.repeat(300));
    expect(excerpt).toBe(`${'a'.repeat(140)}…`);
  });

  it('não acrescenta reticências em exatamente 140 caracteres', () => {
    expect(statementExcerpt('b'.repeat(140))).toBe('b'.repeat(140));
  });
});
