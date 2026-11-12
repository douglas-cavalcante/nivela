import { studyDaySql } from 'src/shared/study/study-day.sql';

describe('studyDaySql', () => {
  it('converte a coluna para o fuso de Fortaleza e trunca para data', () => {
    expect(studyDaySql('qa.created_at').sql).toBe(
      "((qa.created_at) AT TIME ZONE 'America/Fortaleza')::date",
    );
  });

  it('não gera parâmetros', () => {
    expect(studyDaySql('created_at').values).toEqual([]);
  });

  it('recusa um identificador que não seja uma coluna', () => {
    expect(() => studyDaySql('created_at; DROP TABLE users')).toThrow();
    expect(() => studyDaySql("x') OR ('1'='1")).toThrow();
  });
});
