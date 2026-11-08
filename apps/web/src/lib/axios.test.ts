import { http, HttpResponse } from 'msw';
import api, { requireApiUrl, setUnauthorizedHandler } from 'src/lib/axios';
import { clearToken, getToken, setToken } from 'src/lib/auth/tokenStorage';
import { API_URL, server } from 'src/test/server';

const unauthorized = () => HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 });

describe('api (axios)', () => {
  afterEach(() => setUnauthorizedHandler(null));

  it('em 401 limpa o token e chama onUnauthorized uma única vez', async () => {
    server.use(http.get(`${API_URL}/auth/me`, unauthorized), http.get(`${API_URL}/qualquer`, unauthorized));
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setToken('expirado');

    const results = await Promise.allSettled([api.get('/auth/me'), api.get('/qualquer')]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it('volta a avisar em uma nova sessão que expira', async () => {
    server.use(http.get(`${API_URL}/qualquer`, unauthorized));
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    setToken('primeiro');
    await api.get('/qualquer').catch(() => undefined);
    setToken('segundo');
    await api.get('/qualquer').catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('não trata 401 sem sessão como expiração (ex.: senha errada no login)', async () => {
    server.use(http.post(`${API_URL}/auth/login`, unauthorized));
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    clearToken();

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('envia o Bearer salvo e pede JSON', async () => {
    let authorization: string | null = null;
    let accept: string | null = null;
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) => {
        authorization = request.headers.get('authorization');
        accept = request.headers.get('accept');
        return HttpResponse.json({ user: null });
      }),
    );
    setToken('abc');

    await api.get('/auth/me');

    expect(authorization).toBe('Bearer abc');
    expect(accept).toContain('application/json');
  });

  it('não envia Authorization sem token', async () => {
    let authorization: string | null = 'x';
    server.use(
      http.get(`${API_URL}/auth/me`, ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({ user: null });
      }),
    );

    await api.get('/auth/me');

    expect(authorization).toBeNull();
  });
});

describe('requireApiUrl', () => {
  it('devolve a URL configurada', () => {
    expect(requireApiUrl('http://localhost:8000/api/v1')).toBe('http://localhost:8000/api/v1');
  });

  it.each([undefined, '', '   '])('falha com mensagem clara quando VITE_API_URL falta (%j)', (value) => {
    expect(() => requireApiUrl(value)).toThrow(/VITE_API_URL não está definida.*apps\/web\/\.env\.example/);
  });
});
