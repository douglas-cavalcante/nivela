import { screen } from 'expo-router/testing-library';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';

describe('navegação por abas', () => {
  it('mostra as quatro abas', async () => {
    await renderApp({ user: student });

    for (const label of ['Início', 'Estudar', 'Loja', 'Perfil']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
  });

  it('sem usuário, abre a tela de boas-vindas', async () => {
    const { getPathname } = await renderApp({ user: null });

    expect(await screen.findByText('Nivela')).toBeTruthy();
    expect(getPathname()).toBe('/welcome');
  });

  it('com usuário, não deixa abrir a tela de boas-vindas', async () => {
    const { getPathname } = await renderApp({ user: student, initialUrl: '/welcome' });

    expect(await screen.findByText('Início')).toBeTruthy();
    expect(getPathname()).not.toBe('/welcome');
  });
});
