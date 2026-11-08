import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { TeacherList } from 'src/features/teachers/pages/TeacherList';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { admin } from 'src/test/users';

const maria = {
  id: 5,
  name: 'Maria Souza',
  email: 'maria@nivela.dev',
  active: true,
  classrooms_count: 3,
  created_at: '2026-01-10T12:00:00.000Z',
};
const joao = { ...maria, id: 6, name: 'João Lima', email: 'joao@nivela.dev', active: false, classrooms_count: 0 };

const meta = (total: number, page = 1) => ({ page, per_page: 15, total, last_page: Math.max(1, Math.ceil(total / 15)) });

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderPage(route = '/professores') {
  return renderWithProviders(
    <NotifyProvider>
      <TeacherList />
      <Where />
    </NotifyProvider>,
    { user: admin, route },
  );
}

function listHandler(onList?: (params: URLSearchParams) => void, rows = [maria, joao]) {
  server.use(
    http.get(`${API_URL}/teachers`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      onList?.(params);
      return HttpResponse.json({ data: rows, meta: meta(rows.length, Number(params.get('page') ?? 1)) });
    }),
  );
}

describe('TeacherList', () => {
  it('lista professores com turmas e situação', async () => {
    listHandler();
    renderPage();

    const row = (await screen.findByText('Maria Souza')).closest('tr') as HTMLElement;
    expect(within(row).getByText('maria@nivela.dev')).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();
    expect(within(screen.getByText('João Lima').closest('tr') as HTMLElement).getByText('Inativo')).toBeInTheDocument();
  });

  it('digitar na busca atualiza a URL e a lista; sem filtros não manda search nem status', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('search'), params.get('status')));
    renderPage();
    await screen.findByText('Maria Souza');
    expect(seen).toHaveBeenLastCalledWith(null, null);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por nome ou e-mail' }), 'mar');

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/professores?search=mar'));
    await waitFor(() => expect(seen).toHaveBeenLastCalledWith('mar', null));
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
  });

  it('filtro de situação vai para a URL e para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('status')));
    renderPage();
    await screen.findByText('Maria Souza');

    await userEvent.click(screen.getByRole('combobox', { name: 'Situação' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Inativos' }));

    expect(await screen.findByTestId('where')).toHaveTextContent('/professores?status=inactive');
    expect(seen).toHaveBeenLastCalledWith('inactive');
  });

  it('lê busca, situação e página da URL', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('search'), params.get('status'), params.get('page')));
    renderPage('/professores?search=ana&status=active&page=2');
    await screen.findByText('Maria Souza');
    expect(seen).toHaveBeenLastCalledWith('ana', 'active', '2');
  });

  it('situação inválida na URL não vai para a API', async () => {
    const seen = vi.fn();
    listHandler((params) => seen(params.get('status')));
    renderPage('/professores?status=xyz');
    await screen.findByText('Maria Souza');
    expect(seen).toHaveBeenLastCalledWith(null);
  });

  it('cria professor enviando o corpo certo e mostra o aviso da senha inicial', async () => {
    const body = vi.fn();
    listHandler();
    server.use(
      http.post(`${API_URL}/teachers`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(maria, { status: 201 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo professor' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Combine com o professor para trocar a senha no primeiro acesso.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Carla Dias');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'carla@nivela.dev');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'senha1234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar professor' }));

    expect(await screen.findByText('Professor cadastrado.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Carla Dias', email: 'carla@nivela.dev', password: 'senha1234' });
  });

  it('mostra o 422 de e-mail repetido no campo e-mail', async () => {
    listHandler();
    server.use(
      http.post(`${API_URL}/teachers`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', errors: { email: ['Este e-mail já está cadastrado.'] } },
          { status: 422 },
        ),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo professor' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Carla Dias');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'maria@nivela.dev');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'senha1234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar professor' }));

    expect(await within(dialog).findByText('Este e-mail já está cadastrado.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('E-mail')).toBeInvalid();
  });

  it('valida a senha inicial antes de enviar', async () => {
    const post = vi.fn();
    listHandler();
    server.use(http.post(`${API_URL}/teachers`, () => (post(), HttpResponse.json(maria, { status: 201 }))));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Novo professor' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Carla Dias');
    await userEvent.type(within(dialog).getByLabelText('E-mail'), 'carla@nivela.dev');
    await userEvent.type(within(dialog).getByLabelText('Senha inicial'), 'curta');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar professor' }));

    expect(await within(dialog).findByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('edita nome e e-mail sem pedir senha', async () => {
    const body = vi.fn();
    listHandler();
    server.use(
      http.put(`${API_URL}/teachers/5`, async ({ request }) => {
        body(await request.json());
        return HttpResponse.json(maria);
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Editar Maria Souza' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Senha inicial')).toBeNull();
    await userEvent.type(within(dialog).getByLabelText('Nome'), ' Lima');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Professor atualizado.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ name: 'Maria Souza Lima', email: 'maria@nivela.dev' });
  });

  it('redefine a senha com confirmação', async () => {
    const body = vi.fn();
    listHandler();
    server.use(
      http.put(`${API_URL}/teachers/5/password`, async ({ request }) => {
        body(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Redefinir senha de Maria Souza' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nova senha'), 'novasenha1');
    await userEvent.type(within(dialog).getByLabelText('Confirmar nova senha'), 'diferente12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));
    expect(await within(dialog).findByText('A confirmação de senha não confere.')).toBeInTheDocument();
    expect(body).not.toHaveBeenCalled();

    await userEvent.clear(within(dialog).getByLabelText('Confirmar nova senha'));
    await userEvent.type(within(dialog).getByLabelText('Confirmar nova senha'), 'novasenha1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText('Senha redefinida.')).toBeInTheDocument();
    expect(body).toHaveBeenCalledWith({ password: 'novasenha1', password_confirmation: 'novasenha1' });
  });

  it('desativar pede confirmação, avisa das sessões e atualiza a linha', async () => {
    const patch = vi.fn();
    let current = maria;
    server.use(
      http.get(`${API_URL}/teachers`, () => HttpResponse.json({ data: [current], meta: meta(1) })),
      http.patch(`${API_URL}/teachers/5/status`, async ({ request }) => {
        patch(await request.json());
        current = { ...maria, active: false };
        return HttpResponse.json(current);
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Maria Souza' }));
    const dialog = await screen.findByRole('dialog');
    expect(patch).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/sessões abertas serão encerradas/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByText('Professor desativado.')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith({ active: false });
    expect(await screen.findByText('Inativo')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Ativar Maria Souza' })).toBeInTheDocument();
  });

  it('cancelar a confirmação não desativa', async () => {
    const patch = vi.fn();
    listHandler();
    server.use(http.patch(`${API_URL}/teachers/5/status`, () => (patch(), HttpResponse.json(maria))));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Maria Souza' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(patch).not.toHaveBeenCalled();
  });

  it('ativa um professor inativo', async () => {
    const patch = vi.fn();
    listHandler();
    server.use(
      http.patch(`${API_URL}/teachers/6/status`, async ({ request }) => {
        patch(await request.json());
        return HttpResponse.json({ ...joao, active: true });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Ativar João Lima' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ativar' }));

    expect(await screen.findByText('Professor ativado.')).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith({ active: true });
  });

  it('erro ao desativar mostra a mensagem da API', async () => {
    listHandler();
    server.use(
      http.patch(`${API_URL}/teachers/5/status`, () =>
        HttpResponse.json({ message: 'Professor não encontrado.' }, { status: 404 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Desativar Maria Souza' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByText('Professor não encontrado.')).toBeInTheDocument();
  });

  it('pagina pela URL', async () => {
    const seen = vi.fn();
    server.use(
      http.get(`${API_URL}/teachers`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        seen(page);
        return HttpResponse.json({ data: [maria], meta: { page, per_page: 15, total: 31, last_page: 3 } });
      }),
    );
    renderPage();
    await screen.findByText('Maria Souza');

    await userEvent.click(screen.getByRole('button', { name: 'Ir para a próxima página' }));

    expect(await screen.findByTestId('where')).toHaveTextContent('/professores?page=2');
    expect(seen).toHaveBeenLastCalledWith(2);
  });

  it('as ações da linha têm dica em português', async () => {
    listHandler();
    renderPage();
    const edit = await screen.findByRole('button', { name: 'Editar Maria Souza' });
    await userEvent.hover(edit);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Editar');
  });
});
