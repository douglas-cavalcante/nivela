import { screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { networkError, renderApp } from 'src/test/render';

const changeButton = () => screen.getByRole('button', { name: 'Alterar o endereço do servidor' });

describe('endereço do servidor nas telas de entrada', () => {
  it('mostra o servidor padrão sem http:// nem /api/v1, nas boas-vindas e no login', async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(await screen.findByText('Servidor: api.test')).toBeTruthy();
    expect(changeButton()).toBeTruthy();

    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Servidor: api.test')).toBeTruthy();
  });

  it('mostra o servidor salvo na tela de login', async () => {
    await SecureStore.setItemAsync('nivela.serverUrl', 'http://192.168.0.10:8000/api/v1');
    await renderApp({ initialUrl: '/login' });
    expect(await screen.findByText('Servidor: 192.168.0.10:8000')).toBeTruthy();
  });

  it('a folha mostra a ajuda e as mensagens de inválido, inalcançável e sucesso', async () => {
    const user = userEvent.setup();
    let healthy = false;
    await renderApp({
      initialUrl: '/login',
      routes: { 'GET /health': (_body, config) => (healthy ? { status: 200 } : networkError({}, config)) },
    });

    await user.press(await screen.findByRole('button', { name: 'Alterar o endereço do servidor' }));
    expect(screen.getByText('Use o IP do computador que roda a API, na mesma rede Wi-Fi.')).toBeTruthy();

    const field = screen.getByLabelText('Endereço do servidor');
    await user.type(field, 'ftp://x');
    await user.press(screen.getByRole('button', { name: 'Testar e salvar' }));
    expect(await screen.findByText('Digite um endereço como 192.168.0.10:8000.')).toBeTruthy();

    await user.clear(field);
    await user.type(field, '192.168.0.99:8000');
    await user.press(screen.getByRole('button', { name: 'Testar e salvar' }));
    expect(await screen.findByText('Não foi possível conectar a este endereço.')).toBeTruthy();
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBeNull();

    healthy = true;
    await user.press(screen.getByRole('button', { name: 'Testar e salvar' }));
    expect(await screen.findByText('Servidor atualizado.')).toBeTruthy();
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBe('http://192.168.0.99:8000/api/v1');
    expect(screen.getByText('Servidor: 192.168.0.99:8000')).toBeTruthy();
  });

  it('"Usar o padrão" volta ao endereço do app', async () => {
    const user = userEvent.setup();
    await SecureStore.setItemAsync('nivela.serverUrl', 'http://192.168.0.10:8000/api/v1');
    await renderApp({ initialUrl: '/login' });

    await user.press(await screen.findByRole('button', { name: 'Alterar o endereço do servidor' }));
    await user.press(screen.getByRole('button', { name: 'Usar o padrão' }));

    expect(await screen.findByText('Servidor: api.test')).toBeTruthy();
    expect(await SecureStore.getItemAsync('nivela.serverUrl')).toBeNull();
  });

  it('o login usa o endereço salvo como base das requisições', async () => {
    const user = userEvent.setup();
    await SecureStore.setItemAsync('nivela.serverUrl', 'http://192.168.0.10:8000/api/v1');
    let base: string | undefined;
    await renderApp({
      initialUrl: '/login',
      routes: {
        'POST /auth/login': (_body, config) => {
          base = config.baseURL;
          return { status: 422, data: { message: 'Credenciais inválidas.' } };
        },
      },
    });

    await user.type(await screen.findByLabelText('E-mail'), 'a@b.com');
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Credenciais inválidas.');

    expect(base).toBe('http://192.168.0.10:8000/api/v1');
  });
});
