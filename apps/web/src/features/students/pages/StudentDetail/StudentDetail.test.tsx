import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { StudentDetail } from 'src/features/students/pages/StudentDetail';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const lucas = {
  id: 21,
  name: 'Lucas Lima',
  email: 'lucas@aluno.dev',
  active: true,
  classrooms: [
    { id: 7, name: '9º A' },
    { id: 8, name: '8º B' },
  ],
  coins_balance: 120,
  current_streak: 4,
  best_streak: 9,
  created_at: '2026-02-01T12:00:00.000Z',
};

const plans = [
  {
    plan: { id: 5, title: 'Frações do zero', subject: { id: 1, name: 'Matemática', color: 'teal' } },
    completed_chapters: 2,
    total_chapters: 4,
    completed_at: null,
    due_date: '2026-11-20',
  },
  {
    plan: { id: 6, title: 'Verbos', subject: { id: 2, name: 'Português', color: 'coral' } },
    completed_chapters: 3,
    total_chapters: 3,
    completed_at: '2026-11-12T15:00:00.000Z',
    due_date: null,
  },
];

function plansHandler(data: unknown[] = plans) {
  server.use(http.get(`${API_URL}/students/21/plans`, () => HttpResponse.json({ data })));
}

function renderPage(route = '/alunos/21') {
  return renderWithProviders(
    <Routes>
      <Route path="/alunos" element={<p>Lista de alunos</p>} />
      <Route path="/alunos/:id" element={<StudentDetail />} />
    </Routes>,
    { user: teacher, route },
  );
}

const performance = [
  {
    category: { id: 4, name: 'Frações' },
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    finished: 4,
    correct: 3,
    accuracy: 75,
  },
];

describe('StudentDetail', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_URL}/students/21/performance`, () => HttpResponse.json({ data: performance })),
      http.get(`${API_URL}/students/21/coins`, () =>
        HttpResponse.json({
          data: [
            { id: 3, amount: 5, reason: 'correct_answer', description: 'Acerto em Frações.', created_at: '2026-11-10T15:00:00.000Z' },
          ],
          meta: { page: 1, per_page: 10, total: 1, last_page: 1 },
        }),
      ),
    );
  });

  it('mostra o extrato de moedas do aluno', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    plansHandler();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Extrato de moedas' });
    expect(await within(section).findByText('Acerto em Frações.')).toBeInTheDocument();
    expect(within(section).getByText('+5')).toBeInTheDocument();
  });

  it('mostra dados, turmas como links, moedas e sequência', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    plansHandler();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lucas Lima' })).toBeInTheDocument();
    expect(screen.getByText('lucas@aluno.dev')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '9º A' })).toHaveAttribute('href', '/turmas/7');
    expect(screen.getByRole('link', { name: '8º B' })).toHaveAttribute('href', '/turmas/8');
    const coins = screen.getByText('Moedas').closest('div') as HTMLElement;
    expect(within(coins).getByText('120')).toBeInTheDocument();
    const streak = screen.getByText('Sequência atual').closest('div') as HTMLElement;
    expect(within(streak).getByText('4 dias')).toBeInTheDocument();
    const best = screen.getByText('Melhor sequência').closest('div') as HTMLElement;
    expect(within(best).getByText('9 dias')).toBeInTheDocument();
  });

  it('mostra o desempenho do aluno por categoria', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    plansHandler();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Desempenho' });
    expect(await within(section).findByText('Frações')).toBeInTheDocument();
    expect(within(section).getByText('75% (3 de 4).')).toBeInTheDocument();
  });

  it('aluno sem turmas mostra o aviso e sequência no singular', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json({ ...lucas, classrooms: [], current_streak: 1 })));
    plansHandler();
    renderPage();

    expect(await screen.findByRole('region', { name: 'Desempenho' })).toBeInTheDocument();
    expect(screen.queryByText('Planos de estudo — disponível em breve.')).toBeNull();
    expect(screen.getByText('Este aluno ainda não está em nenhuma turma.')).toBeInTheDocument();
    expect(screen.getByText('1 dia')).toBeInTheDocument();
  });

  it('404 da API mostra "não encontrado" com botão de voltar', async () => {
    server.use(
      http.get(`${API_URL}/students/21`, () =>
        HttpResponse.json({ statusCode: 404, message: 'Aluno não encontrado.' }, { status: 404 }),
      ),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Aluno não encontrado.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText('Lista de alunos')).toBeInTheDocument();
  });

  it('falha ao carregar (500) mostra o erro e "Tentar de novo" recarrega', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/students/21`, () =>
        ++calls === 1 ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }) : HttpResponse.json(lucas),
      ),
    );
    plansHandler();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('region', { name: 'Desempenho' })).toBeInTheDocument();
  });

  it('id inválido na URL nem chama a API', async () => {
    const called = vi.fn();
    server.use(http.get(`${API_URL}/students/:id`, () => (called(), HttpResponse.json(lucas))));
    renderPage('/alunos/abc');

    expect(await screen.findByText('Aluno não encontrado.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('lista os planos do aluno com disciplina, capítulos, prazo e conclusão', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    plansHandler();
    renderPage();

    const section = await screen.findByRole('region', { name: 'Planos de estudo' });
    const frações = (await within(section).findByRole('link', { name: 'Frações do zero' })).closest('li') as HTMLElement;
    expect(within(section).getByRole('link', { name: 'Frações do zero' })).toHaveAttribute('href', '/planos/5');
    expect(within(frações).getByText('Matemática')).toBeInTheDocument();
    expect(within(frações).getByText('2 de 4 capítulos')).toBeInTheDocument();
    expect(within(frações).getByRole('progressbar', { name: 'Capítulos concluídos de Frações do zero' })).toHaveAttribute('aria-valuenow', '2');
    expect(within(frações).getByText('Prazo: 20/11/2026.')).toBeInTheDocument();
    expect(within(frações).queryByText(/Concluído em/)).toBeNull();
    const verbos = within(section).getByRole('link', { name: 'Verbos' }).closest('li') as HTMLElement;
    expect(within(verbos).getByText('3 de 3 capítulos')).toBeInTheDocument();
    expect(within(verbos).getByText('Concluído em 12/11/2026.')).toBeInTheDocument();
    expect(within(verbos).queryByText(/Prazo/)).toBeNull();
  });

  it('aluno sem planos mostra o texto vazio', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    plansHandler([]);
    renderPage();

    expect(await screen.findByText('Este aluno ainda não tem planos atribuídos.')).toBeInTheDocument();
  });

  it('falha ao carregar os planos avisa só na seção e "Tentar de novo" recarrega', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
    let calls = 0;
    server.use(
      http.get(`${API_URL}/students/21/plans`, () =>
        ++calls === 1 ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }) : HttpResponse.json({ data: plans }),
      ),
    );
    renderPage();

    const section = await screen.findByRole('region', { name: 'Planos de estudo' });
    expect(await within(section).findByText('Erro interno.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lucas Lima' })).toBeInTheDocument();
    await userEvent.click(within(section).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(section).findByRole('link', { name: 'Frações do zero' })).toBeInTheDocument();
  });
});
