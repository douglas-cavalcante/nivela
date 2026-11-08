import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoryList } from 'src/features/categories/pages/CategoryList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 1, questions_count: 0 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 1, questions_count: 0 };
const algebra = { id: 10, name: 'Álgebra', subject: { id: 1, name: 'Matemática', color: 'teal' }, questions_count: 4 };
const wars = { id: 11, name: 'Guerras', subject: { id: 2, name: 'História', color: 'amber' }, questions_count: 0 };

function renderPage(route = '/categorias') {
  return renderWithProviders(
    <NotifyProvider>
      <CategoryList />
    </NotifyProvider>,
    { user: teacher, route },
  );
}

function handlers(onList?: (subjectId: string | null) => void) {
  server.use(
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })),
    http.get(`${API_URL}/categories`, ({ request }) => {
      const subjectId = new URL(request.url).searchParams.get('subject_id');
      onList?.(subjectId);
      const all = [algebra, wars];
      return HttpResponse.json({ data: subjectId ? all.filter((c) => String(c.subject.id) === subjectId) : all });
    }),
  );
}

describe('CategoryList', () => {
  it('lista categorias com a disciplina', async () => {
    handlers();
    renderPage();
    expect(await screen.findByText('Álgebra')).toBeInTheDocument();
    expect(screen.getByText('Guerras')).toBeInTheDocument();
  });

  it('filtra por disciplina vinda da URL', async () => {
    const seen = vi.fn();
    handlers(seen);
    renderPage('/categorias?subject_id=2');

    expect(await screen.findByText('Guerras')).toBeInTheDocument();
    expect(screen.queryByText('Álgebra')).toBeNull();
    expect(seen).toHaveBeenCalledWith('2');
  });

  it('não envia subject_id quando o filtro está em "Todas"', async () => {
    const seen = vi.fn();
    handlers(seen);
    renderPage();
    await screen.findByText('Álgebra');
    expect(seen).toHaveBeenCalledWith(null);
  });

  it('cria categoria escolhendo a disciplina', async () => {
    const body = vi.fn();
    handlers();
    server.use(
      http.post(`${API_URL}/categories`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(algebra, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nova categoria' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Geometria');
    await userEvent.click(within(dialog).getByRole('combobox', { name: 'Disciplina' }));
    await userEvent.click(await screen.findByRole('option', { name: 'História' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar categoria' }));

    expect(await screen.findByText('Categoria criada.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Geometria', subject_id: 2 });
  });

  it('editar categoria não mostra o seletor de disciplina', async () => {
    const body = vi.fn();
    handlers();
    server.use(
      http.put(`${API_URL}/categories/10`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(algebra);
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Álgebra' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('combobox', { name: 'Disciplina' })).toBeNull();
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Álgebra');
    await userEvent.type(within(dialog).getByLabelText('Nome'), ' linear');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Categoria atualizada.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Álgebra linear' });
  });

  it('mostra o 422 no campo nome', async () => {
    handlers();
    server.use(
      http.put(`${API_URL}/categories/10`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', errors: { name: ['Já existe uma categoria com esse nome nessa disciplina.'] } },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Álgebra' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), '2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(
      await within(dialog).findByText('Já existe uma categoria com esse nome nessa disciplina.'),
    ).toBeInTheDocument();
  });

  it('exclusão bloqueada (409) mostra a mensagem da API', async () => {
    handlers();
    server.use(
      http.delete(`${API_URL}/categories/10`, () =>
        HttpResponse.json({ message: 'Não é possível excluir: a categoria tem questões.' }, { status: 409 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Álgebra' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Não é possível excluir: a categoria tem questões.')).toBeInTheDocument();
  });

  it('ignora um subject_id que não é número', async () => {
    const seen = vi.fn();
    handlers(seen);
    renderPage('/categorias?subject_id=abc');
    expect(await screen.findByText('Álgebra')).toBeInTheDocument();
    expect(seen).toHaveBeenCalledWith(null);
  });

  it('falha ao carregar as disciplinas: avisa e desabilita "Nova categoria"', async () => {
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ message: 'Erro interno.' }, { status: 500 })),
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [algebra] })),
    );
    renderPage();

    expect(await screen.findByText(/Não deu para carregar as disciplinas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova categoria' })).toBeDisabled();
  });
});
