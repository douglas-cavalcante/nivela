import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { expectParams } from 'src/test/expectParams';
import { student } from 'src/test/users';
import { answerTx, redemptionTx, refundTx, stats, streakTx } from 'src/features/coins/__tests__/fixtures';

type RequestConfig = Parameters<FakeHandler>[1];

const page = (data: unknown[], pageNumber = 1, lastPage = 1) => ({
  status: 200,
  data: { data, meta: { page: pageNumber, per_page: 3, total: data.length, last_page: lastPage } },
});
const profileRoutes = {
  'GET /me/classrooms': () => ({ status: 200, data: { data: [] } }),
  'GET /me/stats': () => stats,
};

describe('Perfil: abrir o extrato', () => {
  it('"Ver extrato completo" abre a tela do extrato', async () => {
    const user = userEvent.setup();
    const { getPathname } = await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: {
        ...profileRoutes,
        'GET /me/coins': () => page([refundTx]),
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Ver extrato completo' }));

    expect(await screen.findByText('Extrato de moedas')).toBeTruthy();
    expect(getPathname()).toBe('/coins');
  });
});

describe('Extrato de moedas', () => {
  it('lista as movimentações com sinal, descrição e data', async () => {
    await renderApp({
      user: student,
      initialUrl: '/coins',
      routes: {
        'GET /me/coins': (_body, config: RequestConfig) => {
          expectParams(config, { page: 1, per_page: 10 });
          return page([refundTx, redemptionTx]);
        },
      },
    });

    expect(await screen.findByText('Resgate: Caderno de desenho')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
    expect(screen.getByText('−50')).toBeTruthy();
    expect(screen.getByText('09/11/2026')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('sem movimentações mostra a mensagem de vazio', async () => {
    await renderApp({ user: student, initialUrl: '/coins', routes: { 'GET /me/coins': () => page([]) } });

    expect(await screen.findByText('Você ainda não movimentou moedas.')).toBeTruthy();
  });

  it('"Carregar mais" pede a página 2 e acrescenta sem repetir linhas', async () => {
    const pages: Record<number, ReturnType<typeof page>> = {
      1: page([refundTx, redemptionTx], 1, 2),
      2: page([redemptionTx, answerTx, streakTx], 2, 2),
    };
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/coins',
      routes: {
        'GET /me/coins': (_body, config: RequestConfig) => {
          const requested = Number((config.params as { page: number }).page);
          expectParams(config, { page: requested, per_page: 10 });
          return pages[requested];
        },
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Bônus de sequência')).toBeTruthy();
    expect(screen.getAllByText('Resgate: Caderno de desenho')).toHaveLength(1);
    expect(screen.getByText('Resposta correta')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });
});
