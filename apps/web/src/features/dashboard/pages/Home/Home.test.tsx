import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Home } from 'src/features/dashboard/pages/Home';
import { dashboardHandlers, summary } from 'src/test/dashboard';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

function renderPage() {
  return renderWithProviders(<Home />, { user: teacher });
}

describe('Home', () => {
  it('pede as quatro rotas (atividade de 14 dias) e mostra os números', async () => {
    const urls: string[] = [];
    dashboardHandlers();
    server.use(
      http.get(`${API_URL}/dashboard/activity`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ data: [] });
      }),
    );
    renderPage();

    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(screen.getByText('Olá, Paulo! Bom ver você por aqui.')).toBeInTheDocument();
    const students = await screen.findByRole('group', { name: 'Alunos ativos' });
    expect(within(students).getByText('24')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Questões ativas' })).getByText('130')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Taxa de acerto (30 dias)' })).getByText('72%')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Precisam de ajuda' })).getByText('2')).toBeInTheDocument();
    expect(new URL(urls[0]).searchParams.get('days')).toBe('14');
  });

  it('taxa de acerto nula mostra "—"', async () => {
    dashboardHandlers({ summary: { ...summary, accuracy: null } });
    renderPage();

    const card = await screen.findByRole('group', { name: 'Taxa de acerto (30 dias)' });
    expect(within(card).getByText('—')).toBeInTheDocument();
  });

  it('resume a atividade por texto, com questões terminadas e acertos', async () => {
    dashboardHandlers();
    renderPage();

    // 13 dias x 2 + 10 = 36 terminadas; 13 x 1 + 7 = 20 acertos
    expect(
      await screen.findByRole('img', { name: 'Atividade dos últimos 14 dias: 36 questões terminadas e 20 acertos.' }),
    ).toBeInTheDocument();
  });

  it('atividade sem questões terminadas diz isso em vez de desenhar barras vazias', async () => {
    dashboardHandlers({ activity: [] });
    renderPage();

    expect(await screen.findByText('Ainda não há questões terminadas nos últimos 14 dias.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Atividade dos últimos/ })).toBeNull();
  });

  it('lista quem precisa de ajuda com link para o aluno e o card leva à lista', async () => {
    dashboardHandlers();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Precisam de ajuda' });
    expect(await within(section).findByRole('link', { name: 'Bia Souza' })).toHaveAttribute('href', '/alunos/31');
    const item = within(section).getByRole('link', { name: 'Caio Dias' }).closest('li') as HTMLElement;
    expect(within(item).getByText('25% de acerto em 8 questões terminadas.')).toBeInTheDocument();
    const card = screen.getByRole('group', { name: 'Precisam de ajuda' });
    expect(within(card).getByRole('link', { name: 'Ver a lista.' })).toHaveAttribute('href', '#precisam-de-ajuda');
  });

  it('avisa quando o cartão conta mais alunos do que a lista mostra', async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      student: { id: 100 + index, name: `Aluno ${index + 1}` },
      accuracy: 20,
      finished: 6,
    }));
    dashboardHandlers({ summary: { ...summary, students_needing_help: 13 }, needingHelp: many });
    renderPage();

    const section = await screen.findByRole('region', { name: 'Precisam de ajuda' });
    expect(await within(section).findByText('Mostrando 10 de 13.')).toBeInTheDocument();
  });

  it('não mostra o aviso quando a lista traz todos', async () => {
    dashboardHandlers();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Precisam de ajuda' });
    await within(section).findByRole('link', { name: 'Bia Souza' });
    expect(within(section).queryByText(/Mostrando/)).toBeNull();
  });

  it('lista as questões recentes com link para a questão', async () => {
    dashboardHandlers();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Questões recentes' });
    const link = await within(section).findByRole('link', { name: 'Quanto é 3/4 de 20?' });
    expect(link).toHaveAttribute('href', '/questoes/91');
    const item = link.closest('li') as HTMLElement;
    expect(within(item).getByText('Matemática · Frações')).toBeInTheDocument();
  });

  it('mostra os resgates pendentes com link para a fila', async () => {
    dashboardHandlers();
    renderPage();

    expect(await screen.findByText('Resgates pendentes: 3.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver a fila de resgates.' })).toHaveAttribute('href', '/loja?tab=resgates');
  });

  it('sem pendências nem alunos em dificuldade mostra textos de vazio', async () => {
    dashboardHandlers({
      summary: { ...summary, students_needing_help: 0, pending_redemptions: 0 },
      needingHelp: [],
      recent: [],
    });
    renderPage();

    expect(await screen.findByText('Nenhum aluno precisa de ajuda agora.')).toBeInTheDocument();
    expect(screen.getByText('Ainda não há questões cadastradas.')).toBeInTheDocument();
    expect(screen.getByText('Resgates pendentes: 0.')).toBeInTheDocument();
  });

  it('falha nos indicadores mostra o erro e "Tentar de novo" recarrega', async () => {
    dashboardHandlers();
    let calls = 0;
    server.use(
      http.get(`${API_URL}/dashboard/summary`, () =>
        ++calls === 1 ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }) : HttpResponse.json(summary),
      ),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('group', { name: 'Alunos ativos' })).toBeInTheDocument();
  });

  it('falha na lista de quem precisa de ajuda não derruba o resto', async () => {
    dashboardHandlers();
    server.use(
      http.get(`${API_URL}/dashboard/needing-help`, () => HttpResponse.json({ message: 'Erro interno.' }, { status: 500 })),
    );
    renderPage();

    const section = await screen.findByRole('region', { name: 'Precisam de ajuda' });
    expect(await within(section).findByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Alunos ativos' })).toBeInTheDocument();
  });
});
