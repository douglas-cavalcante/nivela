import {
  loginLimit,
  registerLimit,
  throttleTtlMs,
} from 'src/shared/security/throttle-config';

describe('throttle-config', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa os padrões sem as variáveis', () => {
    delete process.env.THROTTLE_LOGIN_LIMIT;
    delete process.env.THROTTLE_REGISTER_LIMIT;
    delete process.env.THROTTLE_TTL_SECONDS;
    expect(loginLimit()).toBe(10);
    expect(registerLimit()).toBe(30);
    expect(throttleTtlMs()).toBe(60_000);
  });

  it('lê as variáveis (a janela em segundos vira milissegundos)', () => {
    process.env.THROTTLE_LOGIN_LIMIT = '3';
    process.env.THROTTLE_REGISTER_LIMIT = ' 5 ';
    process.env.THROTTLE_TTL_SECONDS = '2';
    expect(loginLimit()).toBe(3);
    expect(registerLimit()).toBe(5);
    expect(throttleTtlMs()).toBe(2000);
  });

  it('volta ao padrão com valor vazio, não numérico ou não positivo', () => {
    for (const value of ['', 'abc', '0', '-4', '2.5']) {
      process.env.THROTTLE_LOGIN_LIMIT = value;
      expect(loginLimit()).toBe(10);
    }
  });
});
