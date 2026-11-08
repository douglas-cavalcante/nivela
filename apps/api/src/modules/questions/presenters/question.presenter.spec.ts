import { Logger } from '@nestjs/common';
import {
  presentQuestion,
  statementExcerpt,
} from 'src/modules/questions/presenters/question.presenter';

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

  it('corta por pontos de código (não parte emojis)', () => {
    const excerpt = statementExcerpt('😀'.repeat(200));
    expect(excerpt).toBe(`${'😀'.repeat(140)}…`);
  });

  it('não deixa espaço antes das reticências', () => {
    expect(statementExcerpt(`${'a'.repeat(139)} ${'b'.repeat(20)}`)).toBe(
      `${'a'.repeat(139)}…`,
    );
  });
});

describe('presentQuestion', () => {
  const base = {
    id: 5,
    authorId: 1,
    statement: 'Enunciado qualquer',
    imagePath: null,
    difficulty: 'easy',
    explanation: 'x',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { id: 1, name: 'M', color: 'teal' },
    category: { id: 1, name: 'C' },
    author: { id: 1, name: 'A' },
  };

  it('sem alternativa correta é dado corrompido: loga e lança', () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const options = ['A', 'B'].map((letter) => ({
      letter,
      text: letter,
      isCorrect: false,
    }));
    expect(() => presentQuestion({ ...base, options }, null, true)).toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
