import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { resolveAssetUrl } from '@nivela/api-contract';
import { getToken, setToken } from 'src/lib/auth/tokenStorage';
import api from 'src/lib/axios';
import { ServerUrlProvider } from 'src/lib/server-url/ServerUrlProvider';
import { useServerUrl } from 'src/lib/server-url/useServerUrl';

const DEFAULT_URL = 'http://api.test/api/v1';
const originalAdapter = api.defaults.adapter;

interface Call {
  url: string;
  baseURL: string | undefined;
  authorization: string;
}

let calls: Call[];
let healthy: boolean;

beforeEach(() => {
  calls = [];
  healthy = true;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push({
      url: String(config.url),
      baseURL: config.baseURL,
      authorization: String(config.headers.get('Authorization') ?? ''),
    });
    if (config.url === '/health' && !healthy) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    return { data: null, status: 200, statusText: '', headers: {}, config };
  };
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
});

type ServerUrl = ReturnType<typeof useServerUrl>;
let current: ServerUrl;

function Probe() {
  const value = useServerUrl();
  useEffect(() => {
    current = value;
  });
  return <Text>{`${value.url}|${resolveAssetUrl(value.url, '/uploads/a.png')}`}</Text>;
}

async function renderProvider() {
  await render(
    <ServerUrlProvider>
      <Probe />
    </ServerUrlProvider>,
  );
  await screen.findByText(/\|/);
}

describe('ServerUrlProvider', () => {
  it('sem valor salvo usa o endereço padrão e as requisições saem para ele', async () => {
    await renderProvider();

    expect(current.url).toBe(DEFAULT_URL);
    expect(current.isDefault).toBe(true);
    await api.get('/qualquer');
    expect(calls[0].baseURL).toBe(DEFAULT_URL);
  });

  it('usa o endereço salvo no aparelho', async () => {
    await SecureStore.setItemAsync('nivela.serverUrl', 'http://192.168.0.10:8000/api/v1');

    await renderProvider();

    expect(current.url).toBe('http://192.168.0.10:8000/api/v1');
    expect(current.isDefault).toBe(false);
    await api.get('/qualquer');
    expect(calls[0].baseURL).toBe('http://192.168.0.10:8000/api/v1');
  });

  it('não testa nem grava nada quando o endereço é inválido', async () => {
    await renderProvider();

    await expect(current.change('ftp://x')).resolves.toBe('invalid');

    expect(calls).toHaveLength(0);
    expect(current.url).toBe(DEFAULT_URL);
  });

  it('com /health falhando devolve unreachable e mantém endereço, token e armazenamento', async () => {
    await setToken('token-antigo');
    await renderProvider();
    healthy = false;

    let result: string | undefined;
    await act(async () => {
      result = await current.change('192.168.0.99:8000');
    });

    expect(result).toBe('unreachable');
    expect(calls[0]).toMatchObject({ url: '/health', baseURL: 'http://192.168.0.99:8000/api/v1' });
    expect(current.url).toBe(DEFAULT_URL);
    expect(await getToken()).toBe('token-antigo');
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBeNull();
  });

  it('o teste de conexão nunca envia o token para o endereço candidato', async () => {
    await setToken('token-antigo');
    await renderProvider();

    await act(async () => {
      await current.change('192.168.0.10:8000');
    });

    expect(calls[0].url).toBe('/health');
    expect(calls[0].authorization).toBe('');
  });

  it('com sucesso salva, troca a base do axios e usa o endereço novo nas imagens', async () => {
    await renderProvider();

    let result: string | undefined;
    await act(async () => {
      result = await current.change('192.168.0.10:8000');
    });

    expect(result).toBe('ok');
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBe('http://192.168.0.10:8000/api/v1');
    expect(current.isDefault).toBe(false);
    await waitFor(() => expect(screen.getByText(/192\.168\.0\.10:8000\/uploads\/a\.png/)).toBeTruthy());

    calls = [];
    await api.get('/qualquer');
    expect(calls[0]).toMatchObject({ baseURL: 'http://192.168.0.10:8000/api/v1' });
  });

  it('reset volta ao padrão e apaga o endereço salvo', async () => {
    await SecureStore.setItemAsync('nivela.serverUrl', 'http://192.168.0.10:8000/api/v1');
    await renderProvider();

    await act(async () => {
      await current.reset();
    });

    expect(current.url).toBe(DEFAULT_URL);
    expect(current.isDefault).toBe(true);
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBeNull();
  });
});
