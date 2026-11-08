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

function renderPage(route = '/alunos/21') {
  return renderWithProviders(
    <Routes>
      <Route path="/alunos" element={<p>Lista de alunos</p>} />
      <Route path="/alunos/:id" element={<StudentDetail />} />
    </Routes>,
    { user: teacher, route },
  );
}

describe('StudentDetail', () => {
  it('mostra dados, turmas como links, moedas e sequência', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json(lucas)));
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

  it('mostra espaços reservados sem dados inventados', async () => {
    server.use(http.get(`${API_URL}/students/21`, () => HttpResponse.json({ ...lucas, classrooms: [], current_streak: 1 })));
    renderPage();

    expect(await screen.findByText('Desempenho do aluno — disponível em breve.')).toBeInTheDocument();
    expect(screen.getByText('Planos de estudo — disponível em breve.')).toBeInTheDocument();
    expect(screen.getByText('Extrato de moedas — disponível em breve.')).toBeInTheDocument();
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
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Desempenho do aluno — disponível em breve.')).toBeInTheDocument();
  });

  it('id inválido na URL nem chama a API', async () => {
    const called = vi.fn();
    server.use(http.get(`${API_URL}/students/:id`, () => (called(), HttpResponse.json(lucas))));
    renderPage('/alunos/abc');

    expect(await screen.findByText('Aluno não encontrado.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });
});
