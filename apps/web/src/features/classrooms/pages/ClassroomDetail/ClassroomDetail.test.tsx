import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { ClassroomDetail } from 'src/features/classrooms/pages/ClassroomDetail';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin } from 'src/test/users';

const lucas = { id: 21, name: 'Lucas Lima', email: 'lucas@aluno.dev', active: true, joined_at: '2026-02-01T12:00:00.000Z' };
const bia = { id: 22, name: 'Bia Souza', email: 'bia@aluno.dev', active: false, joined_at: '2026-02-03T12:00:00.000Z' };

const classroom = {
  id: 7,
  name: '9º A',
  school_year: '2026',
  join_code: 'NIV-4K7Q',
  active: true,
  students_count: 2,
  teacher: { id: 2, name: 'Paulo Professor' },
  created_at: '2026-01-10T12:00:00.000Z',
  students: [lucas, bia],
};

function renderPage(route = '/turmas/7') {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/turmas" element={<p>Lista de turmas</p>} />
        <Route path="/turmas/:id" element={<ClassroomDetail />} />
      </Routes>
    </NotifyProvider>,
    { user: admin, route },
  );
}

function detailHandler(current = classroom) {
  server.use(http.get(`${API_URL}/classrooms/7`, () => HttpResponse.json(current)));
}

describe('ClassroomDetail', () => {
  it('mostra o código, o professor e os alunos matriculados', async () => {
    detailHandler();
    renderPage();

    expect(await screen.findByRole('heading', { name: '9º A' })).toBeInTheDocument();
    expect(screen.getByText('NIV-4K7Q')).toBeInTheDocument();
    expect(screen.getByText('Os alunos entram no app Nivela com este código.')).toBeInTheDocument();
    expect(screen.getByText(/Paulo Professor/)).toBeInTheDocument();
    const row = screen.getByText('Lucas Lima').closest('tr') as HTMLElement;
    expect(within(row).getByText('lucas@aluno.dev')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Lucas Lima' })).toHaveAttribute('href', '/alunos/21');
    expect(within(screen.getByText('Bia Souza').closest('tr') as HTMLElement).getByText('Inativo')).toBeInTheDocument();
    expect(screen.getByText('Desempenho da turma — disponível em breve.')).toBeInTheDocument();
  });

  it('copiar o código usa a área de transferência e avisa', async () => {
    detailHandler();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Copiar código' }));

    expect(writeText).toHaveBeenCalledWith('NIV-4K7Q');
    expect(await screen.findByText('Código copiado.')).toBeInTheDocument();
  });

  it('sem área de transferência, pede para copiar manualmente', async () => {
    detailHandler();
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Copiar código' }));

    expect(await screen.findByText('Copie o código manualmente.')).toBeInTheDocument();
  });

  it('gerar novo código pede confirmação e atualiza o cartão', async () => {
    let code = 'NIV-4K7Q';
    server.use(
      http.get(`${API_URL}/classrooms/7`, () => HttpResponse.json({ ...classroom, join_code: code })),
      http.post(`${API_URL}/classrooms/7/join-code`, () => {
        code = 'NIV-ZZ99';
        return HttpResponse.json({ join_code: code });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Gerar novo código' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('O código antigo deixa de funcionar.')).toBeInTheDocument();
    expect(screen.getByText('NIV-4K7Q')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Gerar novo código' }));

    expect(await screen.findByText('NIV-ZZ99')).toBeInTheDocument();
    expect(screen.queryByText('NIV-4K7Q')).toBeNull();
    expect(await screen.findByText('Novo código gerado.')).toBeInTheDocument();
  });

  it('cancelar a confirmação não gera código', async () => {
    detailHandler();
    const called = vi.fn();
    server.use(
      http.post(`${API_URL}/classrooms/7/join-code`, () => {
        called();
        return HttpResponse.json({ join_code: 'NIV-ZZ99' });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Gerar novo código' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(called).not.toHaveBeenCalled();
  });

  it('adiciona aluno manualmente e atualiza a lista', async () => {
    let students = [lucas];
    const body = vi.fn();
    server.use(
      http.get(`${API_URL}/classrooms/7`, () => HttpResponse.json({ ...classroom, students })),
      http.post(`${API_URL}/classrooms/7/students`, async ({ request }) => {
        body(await request.json());
        students = [lucas, bia];
        return HttpResponse.json({ id: 22, name: 'Bia Souza', email: 'bia@aluno.dev' }, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar aluno' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Bia Souza');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'bia@aluno.dev');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'senha1234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar aluno' }));

    expect(await screen.findByText('Bia Souza')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Bia Souza', email: 'bia@aluno.dev', password: 'senha1234' });
    expect(await screen.findByText('Aluno adicionado à turma.')).toBeInTheDocument();
  });

  it('e-mail já cadastrado mostra a dica no campo e mantém o diálogo aberto', async () => {
    detailHandler();
    const hint = 'Este e-mail já está cadastrado. O aluno pode entrar na turma pelo código.';
    server.use(
      http.post(`${API_URL}/classrooms/7/students`, () =>
        HttpResponse.json({ statusCode: 422, message: 'Dados inválidos.', errors: { email: [hint] } }, { status: 422 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar aluno' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Lucas Lima');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'lucas@aluno.dev');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'senha1234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar aluno' }));

    expect(await within(dialog).findByText(hint)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('valida os campos do aluno antes de enviar', async () => {
    detailHandler();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar aluno' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adicionar aluno' }));

    expect(await within(dialog).findByText('Informe o nome do aluno.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o e-mail.')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe a senha.')).toBeInTheDocument();
  });

  it('remover da turma pede confirmação e atualiza a lista', async () => {
    let students = [lucas, bia];
    const removed = vi.fn();
    server.use(
      http.get(`${API_URL}/classrooms/7`, () => HttpResponse.json({ ...classroom, students })),
      http.delete(`${API_URL}/classrooms/7/students/22`, () => {
        removed();
        students = [lucas];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Remover Bia Souza da turma' }));
    const dialog = await screen.findByRole('dialog');
    expect(removed).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover da turma' }));

    await waitFor(() => expect(screen.queryByText('Bia Souza')).toBeNull());
    expect(removed).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Aluno removido da turma.')).toBeInTheDocument();
    expect(screen.getByText('Lucas Lima')).toBeInTheDocument();
  });

  it('se a recarga após uma mudança falha, mantém a turma na tela e avisa o erro', async () => {
    let failing = false;
    server.use(
      http.get(`${API_URL}/classrooms/7`, () =>
        failing
          ? HttpResponse.json({ statusCode: 500, message: 'Falha ao recarregar.' }, { status: 500 })
          : HttpResponse.json(classroom),
      ),
      http.delete(`${API_URL}/classrooms/7/students/22`, () => {
        failing = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Remover Bia Souza da turma' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remover da turma' }));

    expect(await screen.findByText('Falha ao recarregar.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '9º A' })).toBeInTheDocument();
    expect(screen.getByText('Lucas Lima')).toBeInTheDocument();
    expect(screen.queryByText('Não deu para carregar')).toBeNull();
  });

  it('turma sem alunos mostra o estado vazio', async () => {
    detailHandler({ ...classroom, students: [], students_count: 0 });
    renderPage();

    expect(await screen.findByText('Nenhum aluno nesta turma ainda')).toBeInTheDocument();
  });

  it('404 da API mostra "não encontrada" com botão de voltar', async () => {
    server.use(
      http.get(`${API_URL}/classrooms/7`, () =>
        HttpResponse.json({ statusCode: 404, message: 'Turma não encontrada.' }, { status: 404 }),
      ),
    );
    renderPage();

    expect(await screen.findByText('Turma não encontrada.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText('Lista de turmas')).toBeInTheDocument();
  });

  it('id inválido na URL nem chama a API', async () => {
    const called = vi.fn();
    server.use(http.get(`${API_URL}/classrooms/:id`, () => (called(), HttpResponse.json(classroom))));
    renderPage('/turmas/abc');

    expect(await screen.findByText('Turma não encontrada.')).toBeInTheDocument();
    expect(called).not.toHaveBeenCalled();
  });
});
