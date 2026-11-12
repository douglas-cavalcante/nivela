import { screen } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { expectParams } from 'src/test/expectParams';
import { student } from 'src/test/users';
import { answerTx, redemptionTx, refundTx, stats } from 'src/features/coins/__tests__/fixtures';

type RequestConfig = Parameters<FakeHandler>[1];

const page = (data: unknown[], pageNumber = 1, lastPage = 1) => ({
  status: 200,
  data: { data, meta: { page: pageNumber, per_page: 3, total: data.length, last_page: lastPage } },
});
const noClassrooms = { 'GET /me/classrooms': () => ({ status: 200, data: { data: [] } }) };

describe('Perfil: Minhas moedas', () => {
  it('mostra saldo, sequência atual, melhor sequência e as 3 últimas movimentações', async () => {
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: {
        ...noClassrooms,
        'GET /me/stats': () => stats,
        'GET /me/coins': (_body, config: RequestConfig) => {
          expectParams(config, { page: 1, per_page: 3 });
          return page([refundTx, redemptionTx, answerTx]);
        },
      },
    });

    expect(await screen.findByText('Minhas moedas')).toBeTruthy();
    expect(await screen.findByText('Estorno do resgate: Caderno de desenho')).toBeTruthy();
    expect(screen.getByLabelText('Saldo: 85 moedas.')).toBeTruthy();
    expect(screen.getByLabelText('Sequência atual: 4 dias.')).toBeTruthy();
    expect(screen.getByLabelText('Melhor sequência: 9 dias.')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
    expect(screen.getByText('−50')).toBeTruthy();
    expect(screen.getByText('+10')).toBeTruthy();
    expect(screen.getByText('Resgate: Caderno de desenho')).toBeTruthy();
    expect(screen.getByText('10/11/2026')).toBeTruthy();
  });

  it('sem movimentações mostra a mensagem de vazio', async () => {
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...noClassrooms, 'GET /me/stats': () => stats, 'GET /me/coins': () => page([]) },
    });

    expect(await screen.findByText('Você ainda não movimentou moedas.')).toBeTruthy();
  });
});
