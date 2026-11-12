import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CoinStatement } from 'src/features/dashboard/components/CoinStatement';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const first = [
  { id: 3, amount: 5, reason: 'correct_answer', description: 'Acerto em Frações.', created_at: '2026-11-10T15:00:00.000Z' },
  { id: 2, amount: -50, reason: 'redemption', description: 'Resgate: Caneta gel.', created_at: '2026-11-09T15:00:00.000Z' },
];
const second = [
  { id: 1, amount: 50, reason: 'refund', description: 'Estorno: Caneta gel.', created_at: '2026-11-08T15:00:00.000Z' },
];

function meta(page: number) {
  return { page, per_page: 2, total: 3, last_page: 2 };
}

function render() {
  return renderWithProviders(<CoinStatement studentId={21} />, { user: teacher });
}

describe('CoinStatement', () => {
  it('lista créditos com + e débitos com −, descrição e data', async () => {
    server.use(http.get(`${API_URL}/students/21/coins`, () => HttpResponse.json({ data: first, meta: meta(1) })));
    render();

    const credit = (await screen.findByText('Acerto em Frações.')).closest('tr') as HTMLElement;
    expect(within(credit).getByText('+5')).toBeInTheDocument();
    expect(within(credit).getByText('10/11/2026')).toBeInTheDocument();
    const debit = screen.getByText('Resgate: Caneta gel.').closest('tr') as HTMLElement;
    expect(within(debit).getByText('−50')).toBeInTheDocument();
    expect(within(debit).getByText('09/11/2026')).toBeInTheDocument();
  });

  it('pagina: a página 2 é pedida à API e mostrada', async () => {
    const pages: Array<string | null> = [];
    server.use(
      http.get(`${API_URL}/students/21/coins`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pages.push(page);
        return page === '2'
          ? HttpResponse.json({ data: second, meta: meta(2) })
          : HttpResponse.json({ data: first, meta: meta(1) });
      }),
    );
    render();

    await screen.findByText('Acerto em Frações.');
    await userEvent.click(screen.getByRole('button', { name: 'Ir para a próxima página' }));

    expect(await screen.findByText('Estorno: Caneta gel.')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(screen.queryByText('Acerto em Frações.')).toBeNull();
    expect(pages).toEqual([null, '2']);
  });

  it('sem movimentações mostra o texto de vazio', async () => {
    server.use(
      http.get(`${API_URL}/students/21/coins`, () =>
        HttpResponse.json({ data: [], meta: { page: 1, per_page: 10, total: 0, last_page: 1 } }),
      ),
    );
    render();

    expect(await screen.findByText('Este aluno ainda não tem movimentações de moedas.')).toBeInTheDocument();
  });

  it('falha mostra o erro e "Tentar de novo" recarrega', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/students/21/coins`, () =>
        ++calls === 1
          ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 })
          : HttpResponse.json({ data: first, meta: meta(1) }),
      ),
    );
    render();

    expect(await screen.findByText('Erro interno.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Acerto em Frações.')).toBeInTheDocument();
  });
});
