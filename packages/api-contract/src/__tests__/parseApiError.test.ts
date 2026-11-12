import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { parseApiError } from '../parseApiError';

const GENERIC = 'Algo deu errado. Tente novamente em instantes.';
const NETWORK = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('falhou', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('parseApiError', () => {
  it('erro que não é do axios vira mensagem genérica sem status', () => {
    expect(parseApiError(new Error('x'))).toEqual({ status: null, message: GENERIC, fieldErrors: {} });
  });

  it('sem resposta (rede) devolve a mensagem de conexão', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(parseApiError(error)).toEqual({ status: null, message: NETWORK, fieldErrors: {} });
  });

  it('422 traz a mensagem e os erros por campo', () => {
    const error = httpError(422, { message: 'Dados inválidos.', errors: { email: ['Obrigatório', 'Inválido'] } });
    expect(parseApiError(error)).toEqual({
      status: 422,
      message: 'Dados inválidos.',
      fieldErrors: { email: ['Obrigatório', 'Inválido'] },
    });
  });

  it('corpo malformado (string) cai na mensagem genérica mantendo o status', () => {
    expect(parseApiError(httpError(500, '<html>erro</html>'))).toEqual({
      status: 500,
      message: GENERIC,
      fieldErrors: {},
    });
  });

  it('corpo nulo cai na mensagem genérica', () => {
    expect(parseApiError(httpError(500, null)).message).toBe(GENERIC);
  });

  it('message que não é string (ou vazia) é ignorada', () => {
    expect(parseApiError(httpError(400, { message: ['a', 'b'] })).message).toBe(GENERIC);
    expect(parseApiError(httpError(400, { message: '' })).message).toBe(GENERIC);
  });

  it('errors malformado é descartado; só textos de listas válidas entram', () => {
    expect(parseApiError(httpError(422, { message: 'x', errors: 'oops' })).fieldErrors).toEqual({});
    const mixed = httpError(422, { message: 'x', errors: { a: ['ok', 3], b: 'texto', c: [1] } });
    expect(parseApiError(mixed).fieldErrors).toEqual({ a: ['ok'] });
  });
});
