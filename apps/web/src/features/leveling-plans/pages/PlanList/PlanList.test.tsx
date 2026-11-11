import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { PlanList } from 'src/features/leveling-plans/pages/PlanList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin, teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 1, questions_count: 2 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 1, questions_count: 0 };

const summary = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Plano ${id}`,
  status: 'draft',
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  chapters_count: 3,
  questions_count: 12,
  assignments_count: 0,
  teacher: { id: 2, name: 'Paulo Professor' },
  updated_at: '2026-11-08T10:00:00.000Z',
  ...extra,
});

const meta = (total: number, page = 1) => ({ page, per_page: 15, total, last_page: Math.max(1, Math.ceil(total / 15)) });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderPage(route = '/planos', user = teacher) {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/planos" element={<PlanList />} />
        <Route path="/planos/:id" element={<p>Editor do plano</p>} />
      </Routes>
      <Where />
    </NotifyProvider>,
    { user, route },
  );
}

function handlers(onList?: (params: URLSearchParams) => void, rows: unknown[] = [summary(1), summary(2, { status: 'published', title: 'Frações', assignments_count: 2 })]) {
  server.use(
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })),
    http.get(`${API_URL}/plans`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length, Number(params.get('page') ?? 1)) });
    }),
  );
}

describe('PlanList', () => {
  it('lista os planos com disciplina, contagens e situação', async () => {
    handlers();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Planos' })).toBeInTheDocument();
    const row = (await screen.findByText('Frações')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Matemática')).toBeInTheDocument();
    expect(within(row).getByText('Publicado')).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('12')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    const draft = screen.getByText('Plano 1').closest('tr') as HTMLElement;
    expect(within(draft).getByText('Rascunho')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Professor' })).toBeNull();
  });

  it('o administrador vê também o professor dono do plano', async () => {
    handlers();
    renderPage('/planos', admin);

    expect(await screen.findByRole('columnheader', { name: 'Professor' })).toBeInTheDocument();
    expect(screen.getAllByText('Paulo Professor').length).toBeGreaterThan(0);
  });

  it('busca, situação e disciplina vão para a URL e para a API', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage();
    await screen.findByText('Frações');

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pelo título' }), 'fra');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('search=fra'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ search: 'fra' }));

    await userEvent.click(screen.getByRole('combobox', { name: 'Situação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Publicado' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('status=published'));

    await userEvent.click(screen.getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'História' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('subject_id=2'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ search: 'fra', status: 'published', subject_id: '2' }));
  });

  it('filtros da URL já chegam à API e valores inválidos são ignorados', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage('/planos?status=published&subject_id=abc');

    await screen.findByText('Frações');
    expect(seen).toHaveBeenLastCalledWith({ status: 'published' });
  });

  it('clicar na linha abre o editor', async () => {
    handlers();
    renderPage();

    await userEvent.click(await screen.findByText('Frações'));

    expect(await screen.findByText('Editor do plano')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/planos/2');
  });

  it('sem planos mostra o estado vazio', async () => {
    handlers(undefined, []);
    renderPage();

    expect(await screen.findByText('Nenhum plano ainda.')).toBeInTheDocument();
  });

  it('criar plano envia os dados e abre o editor', async () => {
    handlers();
    const body = vi.fn();
    server.use(
      http.post(`${API_URL}/plans`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json({ ...summary(9, { title: 'Novo plano' }), description: null, completion_bonus: 50, chapters: [], has_progress: false, can_edit: true }, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo plano' });
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Novo plano');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Matemática' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/planos/9'));
    expect(body).toHaveBeenCalledWith({ title: 'Novo plano', description: null, subject_id: 1, completion_bonus: 50 });
  });

  it('valida o título e mostra o erro 422 no campo', async () => {
    handlers();
    server.use(
      http.post(`${API_URL}/plans`, () =>
        HttpResponse.json({ message: 'Dados inválidos.', errors: { subject_id: ['Disciplina não encontrada.'] } }, { status: 422 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo plano' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    expect(await within(dialog).findByText('Informe o título do plano.')).toBeInTheDocument();
    expect(within(dialog).getByText('Escolha a disciplina.')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByLabelText('Título'), 'Plano novo');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Matemática' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));

    expect(await within(dialog).findByText('Disciplina não encontrada.')).toBeInTheDocument();
  });
});
