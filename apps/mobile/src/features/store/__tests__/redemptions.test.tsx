import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { expectParams } from 'src/test/expectParams';
import { student } from 'src/test/users';
import {
  deliveredRedemption,
  pendingRedemption,
  rejectedRedemption,
} from 'src/features/store/__tests__/fixtures';

type RequestConfig = Parameters<FakeHandler>[1];

const page = (data: unknown[], pageNumber = 1, lastPage = 1) => ({
  status: 200,
  data: { data, meta: { page: pageNumber, per_page: 10, total: data.length, last_page: lastPage } },
});

describe('Meus resgates', () => {
  it('mostra o status e o motivo da recusa', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store/redemptions',
      routes: {
        'GET /store/redemptions': (_body, config: RequestConfig) => {
          expectParams(config, { page: 1, per_page: 10 });
          return page([pendingRedemption, rejectedRedemption, deliveredRedemption]);
        },
      },
    });

    expect(await screen.findByText('Caderno de desenho')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getByText('Entregue')).toBeTruthy();
    expect(screen.getByText('Recusado')).toBeTruthy();
    expect(screen.getByText('Motivo: Prêmio indisponível na escola.')).toBeTruthy();
    expect(screen.getByText(/🪙 300/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('sem resgates mostra a mensagem de vazio', async () => {
    await renderApp({
      user: student,
      initialUrl: '/store/redemptions',
      routes: { 'GET /store/redemptions': () => page([]) },
    });

    expect(await screen.findByText('Você ainda não resgatou nenhum prêmio.')).toBeTruthy();
  });

  it('"Carregar mais" busca a próxima página e acrescenta à lista', async () => {
    const pages: Record<number, ReturnType<typeof page>> = {
      1: page([pendingRedemption], 1, 2),
      2: page([deliveredRedemption], 2, 2),
    };
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store/redemptions',
      routes: {
        'GET /store/redemptions': (_body, config: RequestConfig) => {
          const requested = Number((config.params as { page: number }).page);
          expectParams(config, { page: requested, per_page: 10 });
          return pages[requested];
        },
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Lápis de cor')).toBeTruthy();
    expect(screen.getByText('Caderno de desenho')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('a tela da loja leva para Meus resgates', async () => {
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/store',
      routes: {
        'GET /me/stats': () => ({ status: 200, data: { coins_balance: 5, current_streak: 0, best_streak: 0 } }),
        'GET /store/rewards': () => ({ status: 200, data: { data: [] } }),
        'GET /store/redemptions': () => page([pendingRedemption]),
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Meus resgates' }));

    expect(await screen.findByText('Pendente')).toBeTruthy();
  });
});
