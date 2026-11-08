import { NotFoundException } from '@nestjs/common';
import { ParseIdPipe } from 'src/common/pipes/parse-id.pipe';

describe('ParseIdPipe', () => {
  const pipe = new ParseIdPipe('Disciplina não encontrada.');

  it('converte inteiros positivos', () => {
    expect(pipe.transform('12')).toBe(12);
    expect(pipe.transform('2147483647')).toBe(2147483647);
  });

  it.each(['abc', '0', '-1', '1.5', '', '2147483648', '1e3', ' 1'])(
    'responde 404 para %p',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(
        new NotFoundException('Disciplina não encontrada.'),
      );
    },
  );
});
