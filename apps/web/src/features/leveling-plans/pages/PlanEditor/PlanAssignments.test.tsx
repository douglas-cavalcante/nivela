import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { PlanEditor } from 'src/features/leveling-plans/pages/PlanEditor';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 2, questions_count: 9 };

function makePlan(extra: Record<string, unknown> = {}) {
  return {
    id: 5,
    title: 'Frações do zero',
    status: 'published',
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    chapters_count: 1,
    questions_count: 1,
    assignments_count: 0,
    teacher: { id: 2, name: 'Paulo Professor' },
    updated_at: '2026-11-08T10:00:00.000Z',
    description: null,
    completion_bonus: 50,
    has_progress: false,
    can_edit: true,
    chapters: [
      { id: 11, title: 'Conceito de fração', position: 1, questions: [{ id: 101, statement_excerpt: 'Enunciado 101', difficulty: 'easy', active: true }] },
    ],
    ...extra,
  };
}

const classroomA = { id: 7, name: '9º A', school_year: '2026', join_code: 'NIV-4K7Q', active: true, students_count: 1, teacher: { id: 2, name: 'Paulo' }, created_at: '2026-01-10T12:00:00.000Z' };
const classroomB = { ...classroomA, id: 8, name: '8º B', join_code: 'NIV-AAAA' };
const lucas = { id: 21, name: 'Lucas Lima', email: 'lucas@aluno.dev', active: true, classrooms: [], coins_balance: 0, created_at: '2026-02-01T12:00:00.000Z' };

const meta = (total: number) => ({ page: 1, per_page: 20, total, last_page: 1 });

function todayLocal() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function renderPage() {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/planos/:id" element={<PlanEditor />} />
      </Routes>
    </NotifyProvider>,
    { user: teacher, route: '/planos/5' },
  );
}

function baseHandlers(plan = makePlan()) {
  server.use(
    http.get(`${API_URL}/plans/5`, () => HttpResponse.json(plan)),
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math] })),
  );
}

async function openTab(name: string) {
  await userEvent.click(await screen.findByRole('tab', { name }));
}

describe('PlanEditor: atribuições', () => {
  it('lista as atribuições com o alvo, o prazo e "Sem prazo"', async () => {
    baseHandlers();
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () =>
        HttpResponse.json({
          data: [
            { id: 1, target: { type: 'classroom', id: 7, name: '9º A' }, due_date: '2026-11-20', created_at: '2026-11-08T10:00:00.000Z' },
            { id: 2, target: { type: 'student', id: 21, name: 'Lucas Lima' }, due_date: null, created_at: '2026-11-08T10:00:00.000Z' },
          ],
        }),
      ),
    );
    renderPage();
    await openTab('Atribuições');

    const turma = (await screen.findByText('9º A')).closest('tr') as HTMLElement;
    expect(within(turma).getByText('Turma')).toBeInTheDocument();
    expect(within(turma).getByText('20/11/2026')).toBeInTheDocument();
    const aluno = screen.getByText('Lucas Lima').closest('tr') as HTMLElement;
    expect(within(aluno).getByText('Aluno')).toBeInTheDocument();
    expect(within(aluno).getByText('Sem prazo')).toBeInTheDocument();
  });

  it('plano em rascunho pede a publicação antes de atribuir', async () => {
    baseHandlers(makePlan({ status: 'draft' }));
    server.use(http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: [] })));
    renderPage();
    await openTab('Atribuições');

    expect(await screen.findByText('Publique o plano para atribuir.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atribuir' })).toBeDisabled();
  });

  it('atribuir a uma turma envia classroom_id e due_date e atualiza a lista', async () => {
    baseHandlers();
    const created: unknown[] = [];
    const body = vi.fn();
    const classroomSearches = vi.fn();
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: created })),
      http.get(`${API_URL}/classrooms`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        classroomSearches(Object.fromEntries(params));
        return HttpResponse.json({ data: [classroomA, classroomB], meta: meta(2) });
      }),
      http.post(`${API_URL}/plans/5/assignments`, async ({ request }) => {
        body(await request.json());
        const row = { id: 3, target: { type: 'classroom', id: 7, name: '9º A' }, due_date: '2030-12-01', created_at: '2026-11-08T10:00:00.000Z' };
        created.push(row);
        return HttpResponse.json(row, { status: 201 });
      }),
    );
    renderPage();
    await openTab('Atribuições');
    expect(await screen.findByText('Nenhuma atribuição ainda.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Atribuir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atribuir plano' });
    expect(within(dialog).getByRole('radio', { name: 'Turma' })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Buscar turma' }));
    await userEvent.click(await screen.findByRole('option', { name: '9º A' }));
    expect(classroomSearches).toHaveBeenCalledWith({ per_page: '20' });
    const due = within(dialog).getByLabelText('Prazo (opcional)');
    expect(due).toHaveAttribute('min', todayLocal());
    fireEvent.change(due, { target: { value: '2030-12-01' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Atribuir' }));

    await waitFor(() => expect(body).toHaveBeenCalledWith({ classroom_id: 7, due_date: '2030-12-01' }));
    expect(await screen.findByText('01/12/2030')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Atribuir plano' })).toBeNull());
  });

  it('atribuir a um aluno busca em /students e envia student_id sem prazo', async () => {
    baseHandlers();
    const body = vi.fn();
    const studentSearches = vi.fn();
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_URL}/students`, ({ request }) => {
        studentSearches(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json({ data: [lucas], meta: meta(1) });
      }),
      http.post(`${API_URL}/plans/5/assignments`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json({ id: 4, target: { type: 'student', id: 21, name: 'Lucas Lima' }, due_date: null, created_at: '2026-11-08T10:00:00.000Z' }, { status: 201 });
      }),
    );
    renderPage();
    await openTab('Atribuições');

    await userEvent.click(await screen.findByRole('button', { name: 'Atribuir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atribuir plano' });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Aluno' }));
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Buscar aluno' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Lucas Lima' }));
    expect(studentSearches).toHaveBeenCalledWith({ per_page: '20' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Atribuir' }));

    await waitFor(() => expect(body).toHaveBeenCalledWith({ student_id: 21, due_date: null }));
  });

  it('sem escolher o alvo mostra o aviso no campo e não envia', async () => {
    baseHandlers();
    const post = vi.fn();
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: [] })),
      http.post(`${API_URL}/plans/5/assignments`, () => (post(), HttpResponse.json({}, { status: 201 }))),
    );
    renderPage();
    await openTab('Atribuições');

    await userEvent.click(await screen.findByRole('button', { name: 'Atribuir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atribuir plano' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Atribuir' }));

    expect(await within(dialog).findByText('Escolha a turma.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('422 de turma duplicada aparece no campo da turma e o de prazo, no prazo', async () => {
    baseHandlers();
    let calls = 0;
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_URL}/classrooms`, () => HttpResponse.json({ data: [classroomA], meta: meta(1) })),
      http.post(`${API_URL}/plans/5/assignments`, () =>
        ++calls === 1
          ? HttpResponse.json({ message: 'Dados inválidos.', errors: { classroom_id: ['Este plano já foi atribuído a esta turma.'] } }, { status: 422 })
          : HttpResponse.json({ message: 'Dados inválidos.', errors: { due_date: ['A data limite não pode ser no passado.'] } }, { status: 422 }),
      ),
    );
    renderPage();
    await openTab('Atribuições');

    await userEvent.click(await screen.findByRole('button', { name: 'Atribuir' }));
    const dialog = await screen.findByRole('dialog', { name: 'Atribuir plano' });
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Buscar turma' }));
    await userEvent.click(await screen.findByRole('option', { name: '9º A' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Atribuir' }));
    expect(await within(dialog).findByText('Este plano já foi atribuído a esta turma.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Prazo (opcional)'), { target: { value: '2030-01-01' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Atribuir' }));
    expect(await within(dialog).findByText('A data limite não pode ser no passado.')).toBeInTheDocument();
  });

  it('remover uma atribuição pede confirmação e atualiza a lista', async () => {
    baseHandlers();
    let rows = [{ id: 1, target: { type: 'classroom', id: 7, name: '9º A' }, due_date: null, created_at: '2026-11-08T10:00:00.000Z' }];
    const removed = vi.fn();
    server.use(
      http.get(`${API_URL}/plans/5/assignments`, () => HttpResponse.json({ data: rows })),
      http.delete(`${API_URL}/plans/5/assignments/1`, () => {
        removed();
        rows = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();
    await openTab('Atribuições');

    await userEvent.click(await screen.findByRole('button', { name: 'Remover atribuição de 9º A' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover a atribuição?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover atribuição' }));

    await waitFor(() => expect(removed).toHaveBeenCalled());
    expect(await screen.findByText('Nenhuma atribuição ainda.')).toBeInTheDocument();
  });
});

describe('PlanEditor: progresso', () => {
  it('mostra uma linha por aluno com capítulos, acertos e conclusão', async () => {
    baseHandlers();
    server.use(
      http.get(`${API_URL}/plans/5/progress`, () =>
        HttpResponse.json({
          data: [
            { student: { id: 21, name: 'Lucas Lima' }, completed_chapters: 2, total_chapters: 4, answered: 9, correct: 7, completed_at: null },
            { student: { id: 22, name: 'Bia Souza' }, completed_chapters: 4, total_chapters: 4, answered: 12, correct: 12, completed_at: '2026-11-12T15:00:00.000Z' },
          ],
        }),
      ),
    );
    renderPage();
    await openTab('Progresso');

    const lucasRow = (await screen.findByRole('link', { name: 'Lucas Lima' })).closest('tr') as HTMLElement;
    expect(screen.getByRole('link', { name: 'Lucas Lima' })).toHaveAttribute('href', '/alunos/21');
    const bar = within(lucasRow).getByRole('progressbar', { name: 'Capítulos concluídos por Lucas Lima' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(within(lucasRow).getByText('2 de 4')).toBeInTheDocument();
    expect(within(lucasRow).getByText('7/9')).toBeInTheDocument();
    expect(within(lucasRow).getByText('—')).toBeInTheDocument();
    const biaRow = screen.getByRole('link', { name: 'Bia Souza' }).closest('tr') as HTMLElement;
    expect(within(biaRow).getByText('12/12')).toBeInTheDocument();
    expect(within(biaRow).getByText('Concluído em 12/11/2026.')).toBeInTheDocument();
  });

  it('plano sem questões ativas mostra o aviso no lugar da tabela', async () => {
    baseHandlers(
      makePlan({
        chapters: [
          { id: 11, title: 'Conceito de fração', position: 1, questions: [{ id: 101, statement_excerpt: 'Enunciado 101', difficulty: 'easy', active: false }] },
          { id: 12, title: 'Vazio', position: 2, questions: [] },
        ],
      }),
    );
    server.use(
      http.get(`${API_URL}/plans/5/progress`, () =>
        HttpResponse.json({
          data: [{ student: { id: 21, name: 'Lucas Lima' }, completed_chapters: 2, total_chapters: 2, answered: 0, correct: 0, completed_at: '2026-11-12T15:00:00.000Z' }],
        }),
      ),
    );
    renderPage();
    await openTab('Progresso');

    expect(await screen.findByText('Este plano está sem questões disponíveis no momento.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lucas Lima' })).not.toBeInTheDocument();
  });

  it('sem alunos com progresso mostra o estado vazio', async () => {
    baseHandlers();
    server.use(http.get(`${API_URL}/plans/5/progress`, () => HttpResponse.json({ data: [] })));
    renderPage();
    await openTab('Progresso');

    expect(await screen.findByText('Nenhum aluno com este plano ainda.')).toBeInTheDocument();
  });

  it('falha ao carregar mostra o erro e "Tentar de novo" recarrega', async () => {
    baseHandlers();
    let calls = 0;
    server.use(
      http.get(`${API_URL}/plans/5/progress`, () =>
        ++calls === 1 ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }) : HttpResponse.json({ data: [] }),
      ),
    );
    renderPage();
    await openTab('Progresso');

    expect(await screen.findByText('Não deu para carregar.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nenhum aluno com este plano ainda.')).toBeInTheDocument();
  });
});
