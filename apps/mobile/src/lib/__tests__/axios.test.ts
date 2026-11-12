import { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { clearToken, getToken, setToken } from 'src/lib/auth/tokenStorage';
import api, { requireApiUrl, setUnauthorizedHandler } from 'src/lib/axios';

const originalAdapter = api.defaults.adapter;

/** Adapter falso: toda requisição responde 401 `{ message: 'Não autenticado.' }`. */
function respondUnauthorized(sent: string[] = []) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    sent.push(String(config.headers.get('Authorization') ?? ''));
    const response = {
      data: { message: 'Não autenticado.' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    };
    throw new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, response);
  };
}

describe('api (axios)', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    api.defaults.adapter = originalAdapter;
  });

  it('em 401 limpa o token e chama onUnauthorized uma única vez', async () => {
    respondUnauthorized();
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    await setToken('expirado');

    const results = await Promise.allSettled([api.get('/auth/me'), api.get('/qualquer')]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(await getToken()).toBeNull();
  });

  it('volta a avisar em uma nova sessão que expira', async () => {
    respondUnauthorized();
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await setToken('primeiro');
    await api.get('/qualquer').catch(() => undefined);
    await setToken('segundo');
    await api.get('/qualquer').catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('não trata 401 sem sessão como expiração (ex.: senha errada no login)', async () => {
    respondUnauthorized();
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    await clearToken();

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignora o 401 de uma requisição feita com um token que já foi trocado', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    respondUnauthorized();
    const unauthorized = api.defaults.adapter as (config: InternalAxiosRequestConfig) => Promise<never>;
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      await gate; // a resposta 401 só chega depois da troca de sessão
      return unauthorized(config);
    };
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    await setToken('antigo');
    const pending = api.get('/qualquer').catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0)); // a requisição já saiu com o token antigo
    await setToken('novo');
    release();
    await pending;

    expect(await getToken()).toBe('novo');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('desiste da requisição depois de 15 segundos', () => {
    expect(api.defaults.timeout).toBe(15000);
  });

  it('envia o Bearer salvo', async () => {
    const sent: string[] = [];
    respondUnauthorized(sent);
    await setToken('abc');

    await api.get('/auth/me').catch(() => undefined);

    expect(sent).toEqual(['Bearer abc']);
  });

  it('não envia Authorization sem token', async () => {
    const sent: string[] = [];
    respondUnauthorized(sent);

    await api.get('/auth/me').catch(() => undefined);

    expect(sent).toEqual(['']);
  });
});

describe('requireApiUrl', () => {
  it('devolve a URL configurada', () => {
    expect(requireApiUrl('http://10.0.2.2:8000/api/v1')).toBe('http://10.0.2.2:8000/api/v1');
  });

  it.each([undefined, '', '   '])('falha com mensagem clara quando EXPO_PUBLIC_API_URL falta (%j)', (value) => {
    expect(() => requireApiUrl(value)).toThrow(/EXPO_PUBLIC_API_URL não está definida.*apps\/mobile\/\.env\.example/);
  });
});
