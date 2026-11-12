import { screen } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';
import { stats } from 'src/test/studyFixtures';
import { caderno, lapis, mochila } from 'src/features/store/__tests__/fixtures';

const statsRoute = () => ({ status: 200, data: { ...stats, coins_balance: 120 } });
const rewards = (data: unknown[]) => () => ({ status: 200, data: { data } });

describe('aba Loja: vitrine', () => {
  it('lista os prêmios do fake com preço e estoque', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: { 'GET /me/stats': statsRoute, 'GET /store/rewards': rewards([caderno, mochila, lapis]) },
    });

    expect(await screen.findByText('Caderno de desenho')).toBeTruthy();
    expect(screen.getByText('🪙 50')).toBeTruthy();
    expect(screen.getByText('Restam 3.')).toBeTruthy();
    expect(screen.getByText('Mochila escolar')).toBeTruthy();
    expect(screen.getByText('🪙 300')).toBeTruthy();
    expect(screen.getByLabelText('120 moedas.')).toBeTruthy();
  });

  it('sem saldo mostra quantas moedas faltam e desabilita o resgate', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: { 'GET /me/stats': statsRoute, 'GET /store/rewards': rewards([caderno, mochila]) },
    });

    expect(await screen.findByText('Faltam 180 moedas.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resgatar Mochila escolar' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByRole('button', { name: 'Resgatar Caderno de desenho' }).props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('prêmio sem estoque mostra "Esgotado." e não deixa resgatar', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: { 'GET /me/stats': statsRoute, 'GET /store/rewards': rewards([lapis]) },
    });

    expect(await screen.findByText('Esgotado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resgatar Lápis de cor' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('loja sem prêmios mostra a mensagem de vazio', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: { 'GET /me/stats': statsRoute, 'GET /store/rewards': rewards([]) },
    });

    expect(await screen.findByText('A loja está vazia por enquanto.')).toBeTruthy();
  });
});
