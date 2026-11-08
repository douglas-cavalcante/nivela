import { screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

describe('perfil', () => {
  it('mostra os dados do aluno', async () => {
    await renderApp({ user: student, initialUrl: '/profile' });

    expect(await screen.findByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('ana@escola.com')).toBeTruthy();
    expect(screen.getByText('Aluno')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
  });

  it('sair limpa o token e volta para boas-vindas', async () => {
    const logout = jest.fn(() => ({ status: 204 }));
    const user = userEvent.setup();
    const { getPathname } = await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { 'POST /auth/logout': logout },
    });

    await user.press(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByText('Oi! Bora nivelar?')).toBeTruthy();
    expect(getPathname()).toBe('/welcome');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nivela.token');
  });
});
