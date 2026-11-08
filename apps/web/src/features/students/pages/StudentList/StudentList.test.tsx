import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { StudentList } from 'src/features/students/pages/StudentList';
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
  created_at: '2026-02-01T12:00:00.000Z',
};
const bia = { ...lucas, id: 22, name: 'Bia Souza', email: 'bia@aluno.dev', active: false, classrooms: [], coins_balance: 0 };

const meta = (total: number, page = 1) => ({ page, per_page: 15, total, last_page: Math.max(1, Math.ceil(total / 15)) });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderPage(route = '/alunos') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/alunos" element={<StudentList />} />
        <Route path="/alunos/:id" element={<p>Ficha do aluno</p>} />
      </Routes>
      <Where />
    </>,
    { user: teacher, route },
  );
}

function listHandler(onList?: (params: URLSearchParams) => void, rows = [lucas, bia]) {
  server.use(
    http.get(`${API_URL}/students`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length, Number(params.get('page') ?? 1)) });
    }),
    http.get(`${API_URL}/classrooms`, () =>
      HttpResponse.json({
        data: [
          { id: 7, name: '9º A', school_year: '2026', join_code: 'NIV-4K7Q', active: true, students_count: 1, teacher: { id: 2, name: 'Paulo' }, created_at: lucas.created_at },
          { id: 8, name: '8º B', school_year: null, join_code: 'NIV-AAAA', active: true, students_count: 1, teacher: { id: 2, name: 'Paulo' }, created_at: lucas.created_at },
        ],
        meta: meta(2),
      }),
    ),
  );
}

describe('StudentList', () => {
  it('lista alunos com turmas, moedas e situação', async () => {
    listHandler();
    renderPage();

    const row = (await screen.findByText('Lucas Lima')).closest('tr') as HTMLElement;
    expect(within(row).getByText('lucas@aluno.dev')).toBeInTheDocument();
    expect(within(row).getByText('9º A')).toBeInTheDocument();
    expect(within(row).getByText('8º B')).toBeInTheDocument();
    expect(within(row).getByText('120')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();
    const other = screen.getByText('Bia Souza').closest('tr') as HTMLElement;
    expect(within(other).getByText('Inativo')).toBeInTheDocument();
    expect(within(other).getByText('Sem turma')).toBeInTheDocument();
  });

  it('busca vai para a URL e para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('search'), params.get('classroom_id')));
    renderPage();
    await screen.findByText('Lucas Lima');
    expect(seen).toHaveBeenLastCalledWith(null, null);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nome ou e-mail' }), 'luc');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/alunos?search=luc'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith('luc', null));
  });

  it('filtro de turma vai para a URL e para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('classroom_id')));
    renderPage();
    await screen.findByText('Lucas Lima');

    await userEvent.click(screen.getByRole('combobox', { name: 'Turma' }));
    await userEvent.click(await screen.findByRole('option', { name: '9º A' }));

    expect(await screen.findByTestId('where')).toHaveTextContent('/alunos?classroom_id=7');
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith('7'));
  });

  it('turma inválida na URL não vai para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('classroom_id')));
    renderPage('/alunos?classroom_id=abc');
    await screen.findByText('Lucas Lima');
    expect(seen).toHaveBeenLastCalledWith(null);
  });

  it('clicar na linha abre a ficha; clicar na turma abre a turma', async () => {
    listHandler();
    renderPage();

    await userEvent.click(await screen.findByText('Lucas Lima'));
    expect(await screen.findByText('Ficha do aluno')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/alunos/21');
  });

  it('sem alunos mostra o estado vazio', async () => {
    listHandler(undefined, []);
    renderPage();
    expect(await screen.findByText('Nenhum aluno ainda.')).toBeInTheDocument();
  });
});
