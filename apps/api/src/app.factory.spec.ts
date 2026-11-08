import { parseCorsOrigins } from 'src/app.factory';

describe('parseCorsOrigins', () => {
  it('sem CORS_ORIGINS usa as origens de desenvolvimento', () => {
    expect(parseCorsOrigins(undefined)).toContain('http://localhost:5173');
    expect(parseCorsOrigins('   ')).toContain('http://localhost:5173');
  });

  it('separa por vírgula, tira espaços e ignora itens vazios', () => {
    expect(
      parseCorsOrigins(' https://painel.nivela.app , http://localhost:5173,, '),
    ).toEqual(['https://painel.nivela.app', 'http://localhost:5173']);
  });
});
