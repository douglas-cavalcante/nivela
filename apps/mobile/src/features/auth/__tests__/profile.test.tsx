import { screen, userEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

const noClassrooms = {
  'GET /me/classrooms': () => ({ status: 200, data: { data: [] } }),
  'GET /me/stats': () => ({ status: 200, data: { coins_balance: 0, current_streak: 0, best_streak: 0 } }),
  'GET /me/coins': () => ({ status: 200, data: { data: [], meta: { page: 1, per_page: 3, total: 0, last_page: 1 } } }),
};

describe('perfil', () => {
  it('mostra os dados do aluno', async () => {
    await renderApp({ user: student, initialUrl: '/profile', routes: noClassrooms });

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
      routes: { ...noClassrooms, 'POST /auth/logout': logout },
    });

    await user.press(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByText('Oi! Bora nivelar?')).toBeTruthy();
    expect(getPathname()).toBe('/welcome');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('nivela.token');
  });
});
