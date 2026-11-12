import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { PlanEditor } from 'src/features/leveling-plans/pages/PlanEditor';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin, teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 2, questions_count: 9 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 0, questions_count: 0 };
const algebra = { id: 10, name: 'Álgebra', subject: { id: 1, name: 'Matemática', color: 'teal' }, questions_count: 5 };
const geometry = { id: 11, name: 'Geometria', subject: { id: 1, name: 'Matemática', color: 'teal' }, questions_count: 4 };

const question = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  statement_excerpt: `Enunciado ${id}`,
  difficulty: 'easy',
  active: true,
  ...extra,
});

const chapter = (id: number, position: number, title: string, questions: unknown[]) => ({ id, title, position, questions });

function makePlan(extra: Record<string, unknown> = {}) {
  return {
    id: 5,
    title: 'Frações do zero',
    status: 'draft',
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    chapters_count: 2,
    questions_count: 3,
    assignments_count: 0,
    teacher: { id: 2, name: 'Paulo Professor' },
    updated_at: '2026-11-08T10:00:00.000Z',
    description: 'Revisão de frações.',
    completion_bonus: 50,
    has_progress: false,
    can_edit: true,
    chapters: [
      chapter(11, 1, 'Conceito de fração', [question(101), question(102, { difficulty: 'hard' })]),
      chapter(12, 2, 'Operações', [question(103, { active: false })]),
    ],
    ...extra,
  };
}

function renderPage(route = '/planos/5', user = teacher) {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/planos" element={<p>Lista de planos</p>} />
        <Route path="/planos/:id" element={<PlanEditor />} />
      </Routes>
    </NotifyProvider>,
    { user, route },
  );
}

function baseHandlers(plan = makePlan()) {
  server.use(
    http.get(`${API_URL}/plans/5`, () => HttpResponse.json(plan)),
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })),
    http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_URL}/plans/5/progress`, () => HttpResponse.json({ data: [] })),
  );
}

const card = (name: string) => screen.getByRole('region', { name });

describe('PlanEditor', () => {
  it('mostra os dados do plano e os capítulos numerados com as questões', async () => {
    baseHandlers();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Frações do zero' })).toBeInTheDocument();
    expect(screen.getByText('Matemática')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Revisão de frações.')).toBeInTheDocument();
    expect(screen.getByText(/50 moedas/)).toBeInTheDocument();
    expect(screen.queryByText(/Paulo Professor/)).toBeNull();

    const first = card('Capítulo 1: Conceito de fração');
    expect(within(first).getByText('Enunciado 101')).toBeInTheDocument();
    expect(within(first).getByText('Enunciado 102')).toBeInTheDocument();
    expect(within(first).getByText('Difícil')).toBeInTheDocument();
    const second = card('Capítulo 2: Operações');
    expect(within(second).getByText('Enunciado 103')).toBeInTheDocument();
    expect(within(second).getByText('Inativa')).toBeInTheDocument();
  });

  it('o administrador vê o professor dono do plano', async () => {
    baseHandlers();
    renderPage('/planos/5', admin);

    expect(await screen.findByText(/Paulo Professor/)).toBeInTheDocument();
  });

  it('plano que não existe (404) mostra "não encontrado" com botão de voltar', async () => {
    server.use(
      http.get(`${API_URL}/plans/5`, () => HttpResponse.json({ message: 'Plano não encontrado.' }, { status: 404 })),
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [] })),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Plano não encontrado.' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText('Lista de planos')).toBeInTheDocument();
  });

  it('id inválido na URL nem chama a API', async () => {
    const called = vi.fn();
    server.use(http.get(`${API_URL}/plans/:id`, () => (called(), HttpResponse.json(makePlan()))));
    renderPage('/planos/abc');

    expect(await screen.findByText('Plano não encontrado.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });

  it('adiciona um capítulo e mostra o plano devolvido', async () => {
    baseHandlers();
    const body = vi.fn();
    server.use(
      http.post(`${API_URL}/plans/5/chapters`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(
          makePlan({
            chapters: [...makePlan().chapters, chapter(13, 3, 'Problemas', [])],
          }),
          { status: 201 },
        );
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo capítulo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Novo capítulo' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar capítulo' }));
    expect(await within(dialog).findByText('Informe o título do capítulo.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Título'), 'Problemas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar capítulo' }));

    expect(await screen.findByRole('region', { name: 'Capítulo 3: Problemas' })).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ title: 'Problemas' });
  });

  it('renomeia um capítulo', async () => {
    baseHandlers();
    const body = vi.fn();
    server.use(
      http.put(`${API_URL}/plans/5/chapters/12`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(
          makePlan({
            chapters: [makePlan().chapters[0], chapter(12, 2, 'Somar e subtrair', [question(103)])],
          }),
        );
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Renomear capítulo 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear capítulo' });
    const field = within(dialog).getByLabelText('Título');
    expect(field).toHaveValue('Operações');
    await userEvent.clear(field);
    await userEvent.type(field, 'Somar e subtrair');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('region', { name: 'Capítulo 2: Somar e subtrair' })).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ title: 'Somar e subtrair' });
  });

  it('subir e descer capítulos envia chapter_ids na nova ordem', async () => {
    baseHandlers();
    const body = vi.fn();
    server.use(
      http.put(`${API_URL}/plans/5/chapters/order`, async ({ request }) => {
        body(await request.json());
        const [a, b] = makePlan().chapters;
        return HttpResponse.json(makePlan({ chapters: [{ ...b, position: 1 }, { ...a, position: 2 }] }));
      }),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: 'Subir capítulo 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descer capítulo 2' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Descer capítulo 1' }));

    expect(await screen.findByRole('region', { name: 'Capítulo 1: Operações' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Capítulo 2: Conceito de fração' })).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ chapter_ids: [12, 11] });
  });

  it('excluir capítulo pede confirmação e usa o plano devolvido', async () => {
    baseHandlers();
    server.use(
      http.delete(`${API_URL}/plans/5/chapters/12`, () => HttpResponse.json(makePlan({ chapters: [makePlan().chapters[0]] }))),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir capítulo 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Excluir o capítulo?' });
    expect(within(dialog).getByText(/Operações/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir capítulo' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Capítulo 2: Operações' })).toBeNull());
    expect(await screen.findByRole('region', { name: 'Capítulo 1: Conceito de fração' })).toBeInTheDocument();
  });

  it('excluir capítulo de plano com progresso mostra o aviso do 409 e mantém o capítulo', async () => {
    baseHandlers(makePlan({ has_progress: true }));
    const message =
      'O plano já tem progresso de alunos; não é possível remover capítulos ou questões.';
    server.use(http.delete(`${API_URL}/plans/5/chapters/12`, () => HttpResponse.json({ message }, { status: 409 })));
    renderPage();

    expect(await screen.findByText(/já tem progresso de alunos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir capítulo 2' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Excluir o capítulo?' })).getByRole('button', { name: 'Excluir capítulo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('region', { name: 'Capítulo 2: Operações' })).toBeInTheDocument();
  });

  it('subir, descer e remover questões enviam a lista completa na ordem', async () => {
    baseHandlers();
    const bodies: unknown[] = [];
    server.use(
      http.put(`${API_URL}/plans/5/chapters/11/questions`, async ({ request }) => {
        const body = (await request.json()) as { question_ids: number[] };
        bodies.push(body);
        const questions = body.question_ids.map((id) => question(id));
        return HttpResponse.json(makePlan({ chapters: [chapter(11, 1, 'Conceito de fração', questions), makePlan().chapters[1]] }));
      }),
    );
    renderPage();

    const first = within(await screen.findByRole('region', { name: 'Capítulo 1: Conceito de fração' }));
    expect(first.getByRole('button', { name: 'Subir questão 1' })).toBeDisabled();
    await userEvent.click(first.getByRole('button', { name: 'Descer questão 1' }));
    await waitFor(() => expect(bodies).toEqual([{ question_ids: [102, 101] }]));

    await userEvent.click(await within(card('Capítulo 1: Conceito de fração')).findByRole('button', { name: 'Remover questão 1' }));
    await waitFor(() => expect(bodies).toEqual([{ question_ids: [102, 101] }, { question_ids: [101] }]));
    await waitFor(() => expect(screen.queryByText('Enunciado 102')).toBeNull());
  });

  it('adicionar questões busca as ativas da disciplina, esconde as que já estão no capítulo e envia a ordem', async () => {
    baseHandlers();
    const searches = vi.fn();
    const body = vi.fn();
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [algebra, geometry] })),
      http.get(`${API_URL}/questions`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        searches(Object.fromEntries(params));
        const data = [101, 201, 202, 203].map((id) => ({
          ...question(id),
          has_image: false,
          subject: { id: 1, name: 'Matemática', color: 'teal' },
          category: { id: 10, name: 'Álgebra' },
          author: { id: 2, name: 'Paulo Professor' },
          updated_at: '2026-11-08T10:00:00.000Z',
        }));
        return HttpResponse.json({ data, meta: { page: 1, per_page: 20, total: 4, last_page: 1 } });
      }),
      http.put(`${API_URL}/plans/5/chapters/11/questions`, async ({ request }) => {
        const payload = (await request.json()) as { question_ids: number[] };
        body(payload);
        return HttpResponse.json(
          makePlan({
            chapters: [chapter(11, 1, 'Conceito de fração', payload.question_ids.map((id) => question(id))), makePlan().chapters[1]],
          }),
        );
      }),
    );
    renderPage();

    await userEvent.click(within(await screen.findByRole('region', { name: 'Capítulo 1: Conceito de fração' })).getByRole('button', { name: 'Adicionar questões' }));
    const dialog = await screen.findByRole('dialog', { name: 'Adicionar questões' });
    expect(await within(dialog).findByRole('checkbox', { name: /Enunciado 201/ })).toBeInTheDocument();
    expect(searches).toHaveBeenCalledWith({ subject_id: '1', status: 'active', per_page: '20' });
    expect(within(dialog).queryByRole('checkbox', { name: /Enunciado 101/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Adicionar selecionadas' })).toBeDisabled();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Enunciado 203/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Enunciado 201/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar selecionadas' }));

    await waitFor(() => expect(body).toHaveBeenCalledWith({ question_ids: [101, 102, 203, 201] }));
    expect(await screen.findByText('Enunciado 203')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Adicionar questões' })).toBeNull());
  });

  it('o seletor filtra por busca e categoria e mantém as marcadas entre as buscas', async () => {
    baseHandlers();
    const searches = vi.fn();
    const body = vi.fn();
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [algebra, geometry] })),
      http.get(`${API_URL}/questions`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        searches(Object.fromEntries(params));
        const ids = params.get('category_id') === '11' ? [301] : [201];
        const data = ids.map((id) => ({
          ...question(id),
          has_image: false,
          subject: { id: 1, name: 'Matemática', color: 'teal' },
          category: { id: 10, name: 'Álgebra' },
          author: { id: 2, name: 'Paulo Professor' },
          updated_at: '2026-11-08T10:00:00.000Z',
        }));
        return HttpResponse.json({ data, meta: { page: 1, per_page: 20, total: data.length, last_page: 1 } });
      }),
      http.put(`${API_URL}/plans/5/chapters/12/questions`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(makePlan());
      }),
    );
    renderPage();

    await userEvent.click(within(await screen.findByRole('region', { name: 'Capítulo 2: Operações' })).getByRole('button', { name: 'Adicionar questões' }));
    const dialog = await screen.findByRole('dialog', { name: 'Adicionar questões' });
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Enunciado 201/ }));

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Categoria' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Geometria' }));
    await waitFor(() => expect(searches).toHaveBeenLastCalledWith({ subject_id: '1', status: 'active', per_page: '20', category_id: '11' }));
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Enunciado 301/ }));

    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Buscar no enunciado' }), 'área');
    await waitFor(() =>
      expect(searches).toHaveBeenLastCalledWith({ subject_id: '1', status: 'active', per_page: '20', category_id: '11', search: 'área' }),
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar selecionadas' }));
    await waitFor(() => expect(body).toHaveBeenCalledWith({ question_ids: [103, 201, 301] }));
  });

  it('422 ao salvar as questões aparece no seletor', async () => {
    baseHandlers();
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_URL}/questions`, () =>
        HttpResponse.json({
          data: [{ ...question(201), has_image: false, subject: { id: 1, name: 'Matemática', color: 'teal' }, category: { id: 10, name: 'Álgebra' }, author: { id: 2, name: 'Paulo Professor' }, updated_at: '2026-11-08T10:00:00.000Z' }],
          meta: { page: 1, per_page: 20, total: 1, last_page: 1 },
        }),
      ),
      http.put(`${API_URL}/plans/5/chapters/11/questions`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', errors: { question_ids: ['Escolha questões ativas da disciplina do plano.'] } },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(within(await screen.findByRole('region', { name: 'Capítulo 1: Conceito de fração' })).getByRole('button', { name: 'Adicionar questões' }));
    const dialog = await screen.findByRole('dialog', { name: 'Adicionar questões' });
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Enunciado 201/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar selecionadas' }));

    expect(await within(dialog).findByText('Escolha questões ativas da disciplina do plano.')).toBeInTheDocument();
  });

  it('publicar pede confirmação e passa a mostrar "Publicado"', async () => {
    baseHandlers();
    server.use(http.post(`${API_URL}/plans/5/publish`, () => HttpResponse.json(makePlan({ status: 'published' }))));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publicar o plano?' });
    expect(within(dialog).getByText('Depois de publicado, o plano pode ser atribuído às turmas.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByText('Publicado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull());
  });

  it('publicar com capítulo sem questões mostra o aviso do 409 e continua rascunho', async () => {
    baseHandlers();
    const message = 'Adicione ao menos um capítulo com questões antes de publicar.';
    server.use(http.post(`${API_URL}/plans/5/publish`, () => HttpResponse.json({ message }, { status: 409 })));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Publicar o plano?' })).getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Publicar o plano?' })).toBeNull());
  });

  it('editar o plano envia os dados e mostra o 422 da disciplina no campo', async () => {
    baseHandlers();
    const body = vi.fn();
    let fail = true;
    server.use(
      http.put(`${API_URL}/plans/5`, async ({ request }) => {
        body(await request.json());
        if (fail) {
          fail = false;
          return HttpResponse.json(
            { message: 'Dados inválidos.', errors: { subject_id: ['Remova as questões do plano antes de trocar a disciplina.'] } },
            { status: 422 },
          );
        }
        return HttpResponse.json(makePlan({ title: 'Frações II' }));
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar plano' });
    const title = within(dialog).getByLabelText('Título');
    expect(title).toHaveValue('Frações do zero');
    expect(within(dialog).getByLabelText('Bônus de conclusão (moedas)')).toHaveValue('50');
    await userEvent.clear(title);
    await userEvent.type(title, 'Frações II');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'História' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Remova as questões do plano antes de trocar a disciplina.')).toBeInTheDocument();
    expect(body).toHaveBeenLastCalledWith({ title: 'Frações II', description: 'Revisão de frações.', subject_id: 2, completion_bonus: 50 });

    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Matemática' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { name: 'Frações II' })).toBeInTheDocument();
  });
});
