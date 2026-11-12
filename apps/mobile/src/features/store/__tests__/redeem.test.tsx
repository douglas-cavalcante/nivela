import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';
import { stats } from 'src/test/studyFixtures';
import { caderno, mochila, pendingRedemption } from 'src/features/store/__tests__/fixtures';

const statsRoute = () => ({ status: 200, data: { ...stats, coins_balance: 120 } });
const rewards = (data: unknown[]) => () => ({ status: 200, data: { data } });

describe('aba Loja: resgate', () => {
  it('sem saldo o botão não resgata nem abre a confirmação', async () => {
    const redeem = jest.fn(() => ({ status: 201, data: {} }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /store/rewards': rewards([mochila]),
        'POST /store/rewards/2/redeem': redeem,
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Resgatar Mochila escolar' }));

    expect(screen.queryByText('Trocar 300 moedas por Mochila escolar?')).toBeNull();
    expect(redeem).not.toHaveBeenCalled();
  });

  it('pede confirmação e só envia o resgate ao confirmar', async () => {
    const redeem = jest.fn(() => ({
      status: 201,
      data: { redemption: pendingRedemption, coins_balance: 70, stock: 2 },
    }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /store/rewards': rewards([caderno]),
        'POST /store/rewards/1/redeem': redeem,
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Resgatar Caderno de desenho' }));
    expect(screen.getByText('Trocar 50 moedas por Caderno de desenho?')).toBeTruthy();
    expect(screen.getByText('O professor entrega o prêmio na escola.')).toBeTruthy();
    expect(redeem).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Pedido feito! Agora é só combinar a entrega com o professor.')).toBeTruthy();
    expect(redeem).toHaveBeenCalledTimes(1);
  });

  it('cancelar fecha a confirmação sem resgatar', async () => {
    const redeem = jest.fn(() => ({ status: 201, data: {} }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /store/rewards': rewards([caderno]),
        'POST /store/rewards/1/redeem': redeem,
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Resgatar Caderno de desenho' }));
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Trocar 50 moedas por Caderno de desenho?')).toBeNull();
    expect(redeem).not.toHaveBeenCalled();
  });

  it('o sucesso atualiza moedas e estoque e mostra as moedas saindo', async () => {
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /store/rewards': rewards([caderno, mochila]),
        'POST /store/rewards/1/redeem': () => ({
          status: 201,
          data: { redemption: pendingRedemption, coins_balance: 70, stock: 2 },
        }),
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Resgatar Caderno de desenho' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('-50 🪙')).toBeTruthy();
    expect(screen.getByLabelText('70 moedas.')).toBeTruthy();
    expect(screen.getByText('Restam 2.')).toBeTruthy();
    expect(screen.getByText('Faltam 230 moedas.')).toBeTruthy();
  });

  it('409 mostra a mensagem e recarrega a vitrine', async () => {
    const lists = [rewards([caderno])(), rewards([{ ...caderno, stock: 0 }])()];
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /store/rewards': () => lists.shift() ?? rewards([{ ...caderno, stock: 0 }])(),
        'POST /store/rewards/1/redeem': () => ({ status: 409, data: { message: 'Prêmio esgotado.' } }),
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Resgatar Caderno de desenho' }));
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Prêmio esgotado.')).toBeTruthy();
    expect(await screen.findByText('Esgotado.')).toBeTruthy();
    expect(screen.queryByText('Trocar 50 moedas por Caderno de desenho?')).toBeNull();
  });
});
