import { containsInsensitive } from 'src/shared/prisma/contains-insensitive';

describe('containsInsensitive', () => {
  it('busca parcial sem diferenciar maiúsculas', () => {
    expect(containsInsensitive('ana')).toEqual({
      contains: 'ana',
      mode: 'insensitive',
    });
  });

  it('escapa %, _ e \\ para valerem como texto', () => {
    expect(containsInsensitive('100%_a\\b').contains).toBe('100\\%\\_a\\\\b');
  });
});
