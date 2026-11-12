import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SubjectList } from 'src/features/subjects/pages/SubjectList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 3, questions_count: 12 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 1, questions_count: 0 };

function renderPage() {
  return renderWithProviders(
    <NotifyProvider>
      <SubjectList />
    </NotifyProvider>,
    { user: teacher, route: '/disciplinas' },
  );
}

describe('SubjectList', () => {
  it('mostra as disciplinas em cards com contagens', async () => {
    server.use(http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })));
    renderPage();

    expect(await screen.findByText('Matemática')).toBeInTheDocument();
    expect(screen.getByText('3 categorias · 12 questões')).toBeInTheDocument();
    expect(screen.getByText('1 categoria · 0 questões')).toBeInTheDocument();
  });

  it('mostra o estado vazio com convite', async () => {
    server.use(http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [] })));
    renderPage();
    expect(await screen.findByText('Nenhuma disciplina ainda. Que tal começar por Matemática?')).toBeInTheDocument();
  });

  it('cria uma disciplina enviando nome, cor e ícone', async () => {
    const body = vi.fn();
    let list: unknown[] = [];
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: list })),
      http.post(`${API_URL}/subjects`, async ({ request }) => {
        body(await request.json());
        list = [math];
        return HttpResponse.json(math, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nova disciplina' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Matemática');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Coral' }));
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Ciência' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar disciplina' }));

    expect(await screen.findByText('Disciplina criada.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Matemática', color: 'coral', icon: 'flask' });
    expect(await screen.findByText('3 categorias · 12 questões')).toBeInTheDocument();
  });

  it('mostra o 422 no campo nome', async () => {
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [] })),
      http.post(`${API_URL}/subjects`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', errors: { name: ['Já existe uma disciplina com esse nome.'] } },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Nova disciplina' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Matemática');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar disciplina' }));

    expect(await within(dialog).findByText('Já existe uma disciplina com esse nome.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome')).toBeInvalid();
  });

  it('edita uma disciplina com os valores atuais', async () => {
    const body = vi.fn();
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math] })),
      http.put(`${API_URL}/subjects/1`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json({ ...math, name: 'Matemática 2' });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Matemática' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Matemática');
    expect(within(dialog).getByRole('radio', { name: 'Turquesa' })).toBeChecked();
    await userEvent.type(within(dialog).getByLabelText('Nome'), ' 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Disciplina atualizada.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Matemática 2', color: 'teal', icon: 'calculator' });
  });

  it('exclui após confirmar', async () => {
    const removed = vi.fn();
    let list = [math];
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: list })),
      http.delete(`${API_URL}/subjects/1`, () => {
        removed();
        list = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Matemática' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Disciplina excluída.')).toBeInTheDocument();
    expect(removed).toHaveBeenCalled();
  });

  it('exclusão bloqueada (409) mostra a mensagem da API', async () => {
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math] })),
      http.delete(`${API_URL}/subjects/1`, () =>
        HttpResponse.json(
          { message: 'Não é possível excluir: a disciplina tem categorias ou questões.' },
          { status: 409 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Matemática' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }));

    expect(
      await screen.findByText('Não é possível excluir: a disciplina tem categorias ou questões.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Matemática')).toBeInTheDocument();
  });
});
