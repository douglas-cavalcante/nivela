import { lerVariavelDoEnv } from '../env-file.cjs';

const ler = lerVariavelDoEnv as (texto: string, nome: string) => string | undefined;
const NOME = 'EXPO_PUBLIC_API_URL';

describe('lerVariavelDoEnv', () => {
  it('lê um valor simples', () => {
    expect(ler(`${NOME}=http://10.0.2.2:8000/api/v1\n`, NOME)).toBe('http://10.0.2.2:8000/api/v1');
  });

  it('trata valor vazio como ausente, sem capturar a linha seguinte', () => {
    expect(ler(`${NOME}=\nOTHER=foo\n`, NOME)).toBeUndefined();
    expect(ler(`${NOME}=   \r\nOTHER=foo\r\n`, NOME)).toBeUndefined();
  });

  it('aceita fim de linha CRLF', () => {
    expect(ler(`A=1\r\n${NOME}=http://x:1/api/v1\r\nB=2\r\n`, NOME)).toBe('http://x:1/api/v1');
  });

  it('tira aspas duplas e simples', () => {
    expect(ler(`${NOME}="http://x:1"\n`, NOME)).toBe('http://x:1');
    expect(ler(`${NOME}='http://x:1'\n`, NOME)).toBe('http://x:1');
  });

  it('tira comentário em valor sem aspas e depois de aspas, mas mantém # sem espaço', () => {
    expect(ler(`${NOME}=http://x:1 # servidor\n`, NOME)).toBe('http://x:1');
    expect(ler(`${NOME}="http://x:1" # servidor\n`, NOME)).toBe('http://x:1');
    expect(ler(`${NOME}=http://x:1/#a\n`, NOME)).toBe('http://x:1/#a');
    expect(ler(`${NOME}= # só comentário\n`, NOME)).toBeUndefined();
  });

  it('aceita o prefixo export e espaços em volta do igual', () => {
    expect(ler(`export ${NOME} = http://x:1\n`, NOME)).toBe('http://x:1');
  });

  it('ignora linhas comentadas e outras variáveis', () => {
    expect(ler(`# ${NOME}=http://a\nOUTRA_${NOME}=http://b\n`, NOME)).toBeUndefined();
  });
});
