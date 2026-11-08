import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { ClassroomDetail } from 'src/features/classrooms/pages/ClassroomDetail';
import { ClassroomList } from 'src/features/classrooms/pages/ClassroomList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin, teacher } from 'src/test/users';

const sala = {
  id: 7,
  name: '9º A',
  school_year: '2026',
  join_code: 'NIV-4K7Q',
  active: true,
  students_count: 12,
  teacher: { id: 2, name: 'Paulo Professor' },
  created_at: '2026-01-10T12:00:00.000Z',
};
const velha = { ...sala, id: 8, name: '8º B', school_year: null, active: false, students_count: 0 };

const meta = (total: number, page = 1) => ({ page, per_page: 15, total, last_page: Math.max(1, Math.ceil(total / 15)) });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderPage(user = admin, route = '/turmas') {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/turmas" element={<ClassroomList />} />
        <Route path="/turmas/:id" element={<ClassroomDetail />} />
      </Routes>
      <Where />
    </NotifyProvider>,
    { user, route },
  );
}

function listHandler(onList?: (params: URLSearchParams) => void, rows = [sala, velha]) {
  server.use(
    http.get(`${API_URL}/classrooms`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length, Number(params.get('page') ?? 1)) });
    }),
  );
}

function teachersHandler(onList?: (params: URLSearchParams) => void) {
  server.use(
    http.get(`${API_URL}/teachers`, ({ request }) => {
      onList?.(new URL(request.url).searchParams);
      return HttpResponse.json({
        data: [
          { id: 2, name: 'Paulo Professor', email: 'paulo@nivela.dev', active: true, classrooms_count: 1, created_at: sala.created_at },
          { id: 3, name: 'Carla Dias', email: 'carla@nivela.dev', active: true, classrooms_count: 0, created_at: sala.created_at },
        ],
        meta: meta(2),
      });
    }),
  );
}

describe('ClassroomList', () => {
  it('administrador vê nome, ano, código, alunos, professor e situação', async () => {
    listHandler();
    renderPage();

    const row = (await screen.findByText('9º A')).closest('tr') as HTMLElement;
    expect(within(row).getByText('2026')).toBeInTheDocument();
    expect(within(row).getByText('NIV-4K7Q')).toBeInTheDocument();
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('Paulo Professor')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Professor' })).toBeInTheDocument();
    expect(within(screen.getByText('8º B').closest('tr') as HTMLElement).getByText('Inativo')).toBeInTheDocument();
  });

  it('professor não vê a coluna Professor', async () => {
    listHandler();
    renderPage(teacher);

    await screen.findByText('9º A');
    expect(screen.queryByRole('columnheader', { name: 'Professor' })).toBeNull();
    expect(screen.queryByText('Paulo Professor')).toBeNull();
  });

  it('busca e situação vão para a URL e para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('search'), params.get('status')));
    renderPage();
    await screen.findByText('9º A');
    expect(seen).toHaveBeenLastCalledWith(null, null);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nome' }), 'nona');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/turmas?search=nona'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith('nona', null));

    await userEvent.click(screen.getByRole('combobox', { name: 'Situação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Inativas' }));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith('nona', 'inactive'));
  });

  it('situação inválida na URL não vai para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('status')));
    renderPage(admin, '/turmas?status=xyz');
    await screen.findByText('9º A');
    expect(seen).toHaveBeenLastCalledWith(null);
  });

  it('clicar na linha abre o detalhe', async () => {
    listHandler();
    server.use(http.get(`${API_URL}/classrooms/7`, () => HttpResponse.json({ ...sala, students: [] })));
    renderPage();

    await userEvent.click(await screen.findByText('9º A'));

    expect(await screen.findByTestId('where')).toHaveTextContent('/turmas/7');
    expect(await screen.findByText('NIV-4K7Q')).toBeInTheDocument();
  });

  it('administrador cria turma escolhendo o professor e cai no detalhe com o código', async () => {
    const body = vi.fn();
    const teachersQuery = vi.fn();
    listHandler();
    teachersHandler((params) => teachersQuery(params.get('status'), params.get('per_page')));
    const created = { ...sala, id: 9, name: '6º C', school_year: '2026', join_code: 'NIV-ABCD', students_count: 0, students: [] };
    server.use(
      http.post(`${API_URL}/classrooms`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(`${API_URL}/classrooms/9`, () => HttpResponse.json(created)),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nova turma' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), '6º C');
    await userEvent.type(within(dialog).getByLabelText('Ano letivo'), '2026');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar turma' }));
    expect(await within(dialog).findByText('Informe o professor da turma.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Professor' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Carla Dias' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar turma' }));

    expect(await screen.findByText('NIV-ABCD')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: '6º C', school_year: '2026', teacher_id: 3 });
    expect(teachersQuery).toHaveBeenCalledWith('active', '100');
    expect(screen.getByTestId('where')).toHaveTextContent('/turmas/9');
  });

  it('professor cria turma sem escolher professor', async () => {
    const body = vi.fn();
    const teachersCalled = vi.fn();
    listHandler();
    teachersHandler(() => teachersCalled());
    const created = { ...sala, id: 9, name: '6º C', school_year: null, join_code: 'NIV-ABCD', students: [] };
    server.use(
      http.post(`${API_URL}/classrooms`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(`${API_URL}/classrooms/9`, () => HttpResponse.json(created)),
    );
    renderPage(teacher);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova turma' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox', { name: 'Professor' })).toBeNull();
    await userEvent.type(within(dialog).getByLabelText('Nome'), '6º C');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar turma' }));

    expect(await screen.findByText('NIV-ABCD')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: '6º C', school_year: null });
    expect(teachersCalled).not.toHaveBeenCalled();
  });

  it('mostra erro de validação da API no campo', async () => {
    listHandler();
    server.use(
      http.post(`${API_URL}/classrooms`, () =>
        HttpResponse.json(
          { statusCode: 422, message: 'Dados inválidos.', errors: { name: ['O nome deve ter pelo menos 2 caracteres.'] } },
          { status: 422 },
        ),
      ),
    );
    renderPage(teacher);

    await userEvent.click(await screen.findByRole('button', { name: 'Nova turma' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar turma' }));

    expect(await within(dialog).findByText('O nome deve ter pelo menos 2 caracteres.')).toBeInTheDocument();
  });

  it('edita turma: ano limpo vira null e a situação pode mudar', async () => {
    const body = vi.fn();
    listHandler();
    server.use(
      http.put(`${API_URL}/classrooms/7`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json({ ...sala, students: [] });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar 9º A' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox', { name: 'Professor' })).toBeNull();
    await userEvent.clear(within(dialog).getByLabelText('Ano letivo'));
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Turma ativa' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(body).toHaveBeenCalledWith({ name: '9º A', school_year: null, active: false }));
    expect(await screen.findByText('Turma atualizada.')).toBeInTheDocument();
  });
});
