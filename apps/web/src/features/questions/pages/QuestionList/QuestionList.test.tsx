import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { QuestionList } from 'src/features/questions/pages/QuestionList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 1, questions_count: 2 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 1, questions_count: 0 };
const algebra = { id: 10, name: 'Álgebra', subject: { id: 1, name: 'Matemática', color: 'teal' }, questions_count: 2 };
const wars = { id: 11, name: 'Guerras', subject: { id: 2, name: 'História', color: 'amber' }, questions_count: 0 };

const summary = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  statement_excerpt: `Enunciado da questão ${id}`,
  difficulty: 'easy',
  active: true,
  has_image: false,
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  category: { id: 10, name: 'Álgebra' },
  author: { id: 2, name: 'Paulo Professor' },
  updated_at: '2026-11-08T10:00:00.000Z',
  ...extra,
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="url">{location.pathname + location.search}</output>;
}

function renderPage(route = '/questoes') {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route
          path="/questoes"
          element={
            <>
              <QuestionList />
              <LocationProbe />
            </>
          }
        />
        <Route path="/questoes/nova" element={<p>Tela de nova questão</p>} />
        <Route path="/questoes/:id" element={<p>Tela da questão</p>} />
      </Routes>
    </NotifyProvider>,
    { user: teacher, route },
  );
}

const url = () => screen.getByLabelText('url').textContent ?? '';

function handlers(onList?: (params: URLSearchParams) => void) {
  server.use(
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })),
    http.get(`${API_URL}/categories`, ({ request }) => {
      const subjectId = new URL(request.url).searchParams.get('subject_id');
      const all = [algebra, wars];
      return HttpResponse.json({ data: subjectId ? all.filter((c) => String(c.subject.id) === subjectId) : all });
    }),
    http.get(`${API_URL}/questions`, ({ request }) => {
      onList?.(new URL(request.url).searchParams);
      return HttpResponse.json({
        data: [
          summary(1),
          summary(2, { difficulty: 'hard', active: false, subject: { id: 2, name: 'História', color: 'amber' } }),
        ],
        meta: { page: 1, per_page: 15, total: 2, last_page: 1 },
      });
    }),
  );
}

describe('QuestionList', () => {
  it('lista as questões com disciplina, categoria, dificuldade, autor e situação', async () => {
    handlers();
    renderPage();

    expect(await screen.findByText('Enunciado da questão 1')).toBeInTheDocument();
    const second = screen.getByText('Enunciado da questão 2').closest('tr') as HTMLElement;
    expect(within(second).getByText('História')).toBeInTheDocument();
    expect(within(second).getByText('Difícil')).toBeInTheDocument();
    expect(within(second).getByText('Inativo')).toBeInTheDocument();
    const first = screen.getByText('Enunciado da questão 1').closest('tr') as HTMLElement;
    expect(within(first).getByText('Fácil')).toBeInTheDocument();
    expect(within(first).getByText('Álgebra')).toBeInTheDocument();
    expect(within(first).getByText('Paulo Professor')).toBeInTheDocument();
    expect(within(first).getByText('Ativo')).toBeInTheDocument();
  });

  it('não envia filtros vazios à API', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage();
    await screen.findByText('Enunciado da questão 1');
    expect(seen).toHaveBeenLastCalledWith({});
  });

  it('filtros mudam a URL e a requisição', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage();
    await screen.findByText('Enunciado da questão 1');

    await userEvent.click(screen.getByRole('combobox', { name: 'Dificuldade' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Difícil' }));
    await waitFor(() => expect(url()).toBe('/questoes?difficulty=hard'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ difficulty: 'hard' }));

    await userEvent.click(screen.getByRole('combobox', { name: 'Situação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Inativas' }));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ difficulty: 'hard', status: 'inactive' }));

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar no enunciado' }), 'frações');
    await waitFor(() =>
      expect(seen).toHaveBeenLastCalledWith({ difficulty: 'hard', status: 'inactive', search: 'frações' }),
    );
    expect(url()).toContain('search=');
  });

  it('categoria fica desabilitada sem disciplina e depende dela', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage();
    await screen.findByText('Enunciado da questão 1');

    expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'História' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Categoria' })).not.toHaveAttribute('aria-disabled'),
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    expect(screen.queryByRole('option', { name: 'Álgebra' })).toBeNull();
    await userEvent.click(await screen.findByRole('option', { name: 'Guerras' }));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ subject_id: '2', category_id: '11' }));

    // trocar a disciplina limpa a categoria
    await userEvent.click(screen.getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Matemática' }));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith({ subject_id: '1' }));
    expect(url()).toBe('/questoes?subject_id=1');
  });

  it('ignora ids e valores inválidos na URL', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage('/questoes?subject_id=abc&category_id=-3&difficulty=xyz&status=zzz');
    await screen.findByText('Enunciado da questão 1');
    expect(seen).toHaveBeenLastCalledWith({});
  });

  it('só envia a categoria da URL quando há disciplina', async () => {
    const seen = vi.fn();
    handlers((params) => seen(Object.fromEntries(params)));
    renderPage('/questoes?category_id=10');
    await screen.findByText('Enunciado da questão 1');
    expect(seen).toHaveBeenLastCalledWith({});
  });

  it('clicar numa linha abre a questão', async () => {
    handlers();
    renderPage();
    await userEvent.click(await screen.findByText('Enunciado da questão 2'));
    expect(await screen.findByText('Tela da questão')).toBeInTheDocument();
  });

  it('"Nova questão" abre o formulário', async () => {
    handlers();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Nova questão' }));
    expect(await screen.findByText('Tela de nova questão')).toBeInTheDocument();
  });

  it('mostra o estado vazio quando os filtros não encontram nada', async () => {
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math] })),
      http.get(`${API_URL}/questions`, () =>
        HttpResponse.json({ data: [], meta: { page: 1, per_page: 15, total: 0, last_page: 1 } }),
      ),
    );
    renderPage('/questoes?difficulty=hard');
    expect(await screen.findByText('Nenhuma questão encontrada')).toBeInTheDocument();
  });
});
