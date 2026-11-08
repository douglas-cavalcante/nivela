import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { QuestionForm } from 'src/features/questions/pages/QuestionForm';
import { NotifyProvider } from 'src/lib/notify/NotifyProvider';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const math = { id: 1, name: 'Matemática', color: 'teal', icon: 'calculator', categories_count: 1, questions_count: 2 };
const history = { id: 2, name: 'História', color: 'amber', icon: 'book', categories_count: 1, questions_count: 0 };
const algebra = { id: 10, name: 'Álgebra', subject: { id: 1, name: 'Matemática', color: 'teal' }, questions_count: 2 };
const wars = { id: 11, name: 'Guerras', subject: { id: 2, name: 'História', color: 'amber' }, questions_count: 0 };

// digitar caractere a caractere em muitos campos é lento em máquinas carregadas
vi.setConfig({ testTimeout: 20000 });

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
// A API devolve o caminho relativo à raiz; a prévia usa a origem de VITE_API_URL.
const IMAGE_PATH = '/uploads/questions/7-abc.png';
const IMAGE_URL = 'http://localhost:8000/uploads/questions/7-abc.png';

const stored = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  statement: 'Quanto é dois mais dois no sistema decimal?',
  explanation: 'É uma soma simples.',
  image_url: null,
  difficulty: 'easy',
  active: true,
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  category: { id: 10, name: 'Álgebra' },
  author: { id: 2, name: 'Paulo Professor' },
  correct_letter: 'B',
  options: LETTERS.map((letter) => ({ letter, text: `Opção ${letter}` })),
  can_edit: true,
  created_at: '2026-11-08T10:00:00.000Z',
  updated_at: '2026-11-08T10:00:00.000Z',
  ...extra,
});

function renderPage(route: string) {
  return renderWithProviders(
    <NotifyProvider>
      <Routes>
        <Route path="/questoes" element={<p>Lista de questões</p>} />
        <Route path="/questoes/nova" element={<QuestionForm />} />
        <Route path="/questoes/:id" element={<QuestionForm />} />
      </Routes>
    </NotifyProvider>,
    { user: teacher, route },
  );
}

function lookups() {
  server.use(
    http.get(`${API_URL}/subjects`, () => HttpResponse.json({ data: [math, history] })),
    http.get(`${API_URL}/categories`, ({ request }) => {
      const subjectId = new URL(request.url).searchParams.get('subject_id');
      const all = [algebra, wars];
      return HttpResponse.json({ data: subjectId ? all.filter((c) => String(c.subject.id) === subjectId) : all });
    }),
  );
}

async function pick(combobox: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: combobox }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

/** Cola o texto de uma vez (muito mais rápido que digitar tecla a tecla). */
async function fill(name: string, text: string) {
  await userEvent.click(screen.getByRole('textbox', { name }));
  await userEvent.paste(text);
}

async function fillValid() {
  await pick('Disciplina', 'Matemática');
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Categoria' })).not.toHaveAttribute('aria-disabled'));
  await pick('Categoria', 'Álgebra');
  await userEvent.click(screen.getByRole('button', { name: 'Médio' }));
  await fill('Enunciado', 'Quanto é dois mais dois?');
  for (const letter of LETTERS) await fill(`Alternativa ${letter}`, `Texto ${letter}`);
  await fill('Explicação', 'Soma simples.');
}

const pngFile = (size = 10, name = 'figura.png', type = 'image/png') =>
  new File([new Uint8Array(size)], name, { type });

describe('QuestionForm', () => {
  describe('criação', () => {
    it('mostra as alternativas A–E e orienta sobre a imagem', async () => {
      lookups();
      renderPage('/questoes/nova');

      for (const letter of LETTERS) {
        expect(await screen.findByRole('textbox', { name: `Alternativa ${letter}` })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: `Alternativa ${letter} é a correta` })).not.toBeChecked();
      }
      expect(screen.getByText('Explique a resolução — o aluno vê depois de responder.')).toBeInTheDocument();
      expect(screen.getByText('Salve a questão para adicionar uma imagem.')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('envia o QuestionPayload e abre a questão criada com aviso', async () => {
      const body = vi.fn();
      lookups();
      server.use(
        http.post(`${API_URL}/questions`, async ({ request }) => {
          body(await request.json());
          return HttpResponse.json(stored(), { status: 201 });
        }),
        http.get(`${API_URL}/questions/7`, () => HttpResponse.json(stored())),
      );
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await fillValid();
      await userEvent.click(screen.getByRole('radio', { name: 'Alternativa C é a correta' }));
      await userEvent.click(screen.getByRole('button', { name: 'Criar questão' }));

      expect(await screen.findByText('Questão criada.')).toBeInTheDocument();
      expect(body).toHaveBeenCalledWith({
        subject_id: 1,
        category_id: 10,
        statement: 'Quanto é dois mais dois?',
        difficulty: 'medium',
        explanation: 'Soma simples.',
        options: LETTERS.map((letter) => ({ letter, text: `Texto ${letter}` })),
        correct_letter: 'C',
      });
      expect(await screen.findByRole('heading', { name: 'Editar questão' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Enunciado' })).toHaveValue('Quanto é dois mais dois no sistema decimal?');
    });

    it('sem alternativa correta mostra o erro e não envia nada', async () => {
      const post = vi.fn();
      lookups();
      server.use(
        http.post(`${API_URL}/questions`, () => {
          post();
          return HttpResponse.json(stored(), { status: 201 });
        }),
      );
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await fillValid();
      await userEvent.click(screen.getByRole('button', { name: 'Criar questão' }));

      expect(await screen.findByText('Escolha a alternativa correta.')).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    });

    it('só uma alternativa pode ser a correta', async () => {
      lookups();
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await userEvent.click(screen.getByRole('radio', { name: 'Alternativa B é a correta' }));
      await userEvent.click(screen.getByRole('radio', { name: 'Alternativa D é a correta' }));

      expect(screen.getByRole('radio', { name: 'Alternativa B é a correta' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Alternativa D é a correta' })).toBeChecked();
    });

    it('mostra os campos obrigatórios com as mensagens da API', async () => {
      lookups();
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await userEvent.click(screen.getByRole('button', { name: 'Criar questão' }));

      expect(await screen.findByText('Escolha a disciplina.')).toBeInTheDocument();
      expect(screen.getByText('Escolha a dificuldade.')).toBeInTheDocument();
      expect(screen.getByText('O enunciado deve ter pelo menos 10 caracteres.')).toBeInTheDocument();
      expect(screen.getByText('Informe a explicação.')).toBeInTheDocument();
      expect(screen.getAllByText('Informe o texto da alternativa.')).toHaveLength(5);
    });

    it('mostra o 422 de options.2.text na linha C e o de category_id no campo', async () => {
      lookups();
      server.use(
        http.post(`${API_URL}/questions`, () =>
          HttpResponse.json(
            {
              message: 'Dados inválidos.',
              errors: {
                'options.2.text': ['A alternativa deve ter no máximo 1000 caracteres.'],
                category_id: ['A categoria não pertence à disciplina.'],
              },
            },
            { status: 422 },
          ),
        ),
      );
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await fillValid();
      await userEvent.click(screen.getByRole('radio', { name: 'Alternativa A é a correta' }));
      await userEvent.click(screen.getByRole('button', { name: 'Criar questão' }));

      const rowC = (await screen.findByRole('textbox', { name: 'Alternativa C' })).closest('li') as HTMLElement;
      expect(await within(rowC).findByText('A alternativa deve ter no máximo 1000 caracteres.')).toBeInTheDocument();
      expect(screen.getByText('A categoria não pertence à disciplina.')).toBeInTheDocument();
    });

    it('mostra o erro geral de options enviado pela API', async () => {
      lookups();
      server.use(
        http.post(`${API_URL}/questions`, () =>
          HttpResponse.json(
            { message: 'Dados inválidos.', errors: { options: ['Informe as 5 alternativas, de A a E.'] } },
            { status: 422 },
          ),
        ),
      );
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await fillValid();
      await userEvent.click(screen.getByRole('radio', { name: 'Alternativa A é a correta' }));
      await userEvent.click(screen.getByRole('button', { name: 'Criar questão' }));

      expect(await screen.findByText('Informe as 5 alternativas, de A a E.')).toBeInTheDocument();
    });

    it('trocar a disciplina limpa a categoria', async () => {
      lookups();
      renderPage('/questoes/nova');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await pick('Disciplina', 'Matemática');
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Categoria' })).not.toHaveAttribute('aria-disabled'),
      );
      await pick('Categoria', 'Álgebra');
      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Álgebra');

      await pick('Disciplina', 'História');
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Categoria' })).not.toHaveTextContent('Álgebra'));
    });
  });

  describe('edição', () => {
    it('carrega a questão e salva com PUT', async () => {
      const body = vi.fn();
      lookups();
      server.use(
        http.get(`${API_URL}/questions/7`, () => HttpResponse.json(stored())),
        http.put(`${API_URL}/questions/7`, async ({ request }) => {
          body(await request.json());
          return HttpResponse.json(stored({ statement: 'Quanto é dois mais dois no sistema binário?' }));
        }),
      );
      renderPage('/questoes/7');

      const statement = await screen.findByRole('textbox', { name: 'Enunciado' });
      expect(statement).toHaveValue('Quanto é dois mais dois no sistema decimal?');
      expect(screen.getByRole('radio', { name: 'Alternativa B é a correta' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Fácil' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('combobox', { name: 'Disciplina' })).toHaveTextContent('Matemática');
      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Álgebra');

      await userEvent.clear(statement);
      await userEvent.paste('Quanto é dois mais dois no sistema binário?');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

      expect(await screen.findByText('Questão atualizada.')).toBeInTheDocument();
      expect(body).toHaveBeenCalledWith({
        subject_id: 1,
        category_id: 10,
        statement: 'Quanto é dois mais dois no sistema binário?',
        difficulty: 'easy',
        explanation: 'É uma soma simples.',
        options: LETTERS.map((letter) => ({ letter, text: `Opção ${letter}` })),
        correct_letter: 'B',
      });
    });

    it('mostra a mensagem da API quando o salvamento é negado (403)', async () => {
      lookups();
      server.use(
        http.get(`${API_URL}/questions/7`, () => HttpResponse.json(stored())),
        http.put(`${API_URL}/questions/7`, () =>
          HttpResponse.json({ message: 'Só o autor ou um administrador pode editar esta questão.' }, { status: 403 }),
        ),
      );
      renderPage('/questoes/7');
      await screen.findByRole('textbox', { name: 'Enunciado' });

      await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

      expect(await screen.findByText('Só o autor ou um administrador pode editar esta questão.')).toBeInTheDocument();
    });

    it('abre em modo leitura quando a questão é de outro autor', async () => {
      lookups();
      server.use(http.get(`${API_URL}/questions/7`, () => HttpResponse.json(stored({ can_edit: false }))));
      renderPage('/questoes/7');

      expect(await screen.findByText(/Paulo Professor/)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Só o autor ou um administrador pode editar esta questão.');
      expect(screen.getByRole('textbox', { name: 'Enunciado' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Alternativa A' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Alternativa B é a correta' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Alternativa B é a correta' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Médio' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Explicação' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Salvar alterações' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Adicionar imagem' })).toBeNull();
    });

    it('mostra "não encontrada" quando a API responde 404', async () => {
      lookups();
      server.use(
        http.get(`${API_URL}/questions/99`, () => HttpResponse.json({ message: 'Questão não encontrada.' }, { status: 404 })),
      );
      renderPage('/questoes/99');
      expect(await screen.findByText('Questão não encontrada.')).toBeInTheDocument();
    });

    it('id inválido na URL não consulta a API', async () => {
      lookups();
      renderPage('/questoes/abc');
      expect(await screen.findByText('Questão não encontrada.')).toBeInTheDocument();
    });
  });

  describe('situação', () => {
    function statusPage(extra: Record<string, unknown> = {}) {
      lookups();
      server.use(http.get(`${API_URL}/questions/7`, () => HttpResponse.json(stored(extra))));
      renderPage('/questoes/7');
    }

    it('desativa depois de confirmar e envia { active: false }', async () => {
      const body = vi.fn();
      server.use(
        http.patch(`${API_URL}/questions/7/status`, async ({ request }) => {
          body(await request.json());
          return HttpResponse.json(stored({ active: false }));
        }),
      );
      statusPage();

      await userEvent.click(await screen.findByRole('switch', { name: 'Questão ativa' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Questões inativas não aparecem para os alunos.')).toBeInTheDocument();
      expect(body).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

      expect(await screen.findByText('Questão desativada.')).toBeInTheDocument();
      expect(body).toHaveBeenCalledWith({ active: false });
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Questão ativa' })).not.toBeChecked());
      expect(screen.getByText('Inativo')).toBeInTheDocument();
    });

    it('ativa sem pedir confirmação e envia { active: true }', async () => {
      const body = vi.fn();
      server.use(
        http.patch(`${API_URL}/questions/7/status`, async ({ request }) => {
          body(await request.json());
          return HttpResponse.json(stored({ active: true }));
        }),
      );
      statusPage({ active: false });

      await userEvent.click(await screen.findByRole('switch', { name: 'Questão ativa' }));

      expect(await screen.findByText('Questão ativada.')).toBeInTheDocument();
      expect(body).toHaveBeenCalledWith({ active: true });
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('mostra a mensagem da API quando é negado (403) e mantém a situação', async () => {
      server.use(
        http.patch(`${API_URL}/questions/7/status`, () =>
          HttpResponse.json({ message: 'Só o autor ou um administrador pode editar esta questão.' }, { status: 403 }),
        ),
      );
      statusPage();

      await userEvent.click(await screen.findByRole('switch', { name: 'Questão ativa' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desativar' }));

      expect(await screen.findByText('Só o autor ou um administrador pode editar esta questão.')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Questão ativa' })).toBeChecked());
    });

    it('não mostra o controle em modo leitura', async () => {
      statusPage({ can_edit: false });
      await screen.findByText(/Paulo Professor/);
      expect(screen.queryByRole('switch', { name: 'Questão ativa' })).toBeNull();
    });
  });

  describe('imagem', () => {
    function editPage(question = stored()) {
      lookups();
      server.use(http.get(`${API_URL}/questions/7`, () => HttpResponse.json(question)));
      renderPage('/questoes/7');
    }

    it('recusa no cliente um arquivo maior que 2 MB, sem requisição', async () => {
      const post = vi.fn();
      server.use(
        http.post(`${API_URL}/questions/7/image`, () => {
          post();
          return HttpResponse.json({ image_url: IMAGE_PATH });
        }),
      );
      editPage();
      const input = await screen.findByLabelText('Arquivo da imagem');

      await userEvent.upload(input, pngFile(2 * 1024 * 1024 + 1));

      expect(await screen.findByText('A imagem deve ter no máximo 2 MB.')).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    });

    it('recusa no cliente um tipo que não é JPG, PNG ou WEBP', async () => {
      const post = vi.fn();
      server.use(
        http.post(`${API_URL}/questions/7/image`, () => {
          post();
          return HttpResponse.json({ image_url: IMAGE_PATH });
        }),
      );
      editPage();
      const input = await screen.findByLabelText('Arquivo da imagem');

      fireEvent.change(input, { target: { files: [new File(['%PDF'], 'prova.pdf', { type: 'application/pdf' })] } });

      expect(await screen.findByText('Envie uma imagem JPG, PNG ou WEBP.')).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
    });

    it('envia o arquivo no campo "image" e mostra a prévia com o caminho devolvido resolvido na origem da API', async () => {
      const received = vi.fn();
      server.use(
        http.post(`${API_URL}/questions/7/image`, async ({ request }) => {
          const data = await request.formData();
          const file = data.get('image');
          // o File do servidor de teste (undici) não é o do jsdom: compara só o que importa
          received(typeof file === 'string' || file === null ? file : { name: file.name, size: file.size });
          return HttpResponse.json({ image_url: IMAGE_PATH });
        }),
      );
      editPage();
      expect(await screen.findByText('Nenhuma imagem.')).toBeInTheDocument();

      await userEvent.upload(await screen.findByLabelText('Arquivo da imagem'), pngFile(1024, 'figura.png'));

      const preview = await screen.findByRole('img', { name: 'Imagem da questão' });
      expect(preview).toHaveAttribute('src', IMAGE_URL);
      expect(received).toHaveBeenCalledWith({ name: 'figura.png', size: 1024 });
      expect(await screen.findByText('Imagem enviada.')).toBeInTheDocument();
    });

    it('mostra o 422 da API no campo da imagem', async () => {
      server.use(
        http.post(`${API_URL}/questions/7/image`, () =>
          HttpResponse.json(
            { message: 'Dados inválidos.', errors: { image: ['Envie uma imagem JPG, PNG ou WEBP.'] } },
            { status: 422 },
          ),
        ),
      );
      editPage();

      await userEvent.upload(await screen.findByLabelText('Arquivo da imagem'), pngFile());

      expect(await screen.findByText('Envie uma imagem JPG, PNG ou WEBP.')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Imagem da questão' })).toBeNull();
    });

    it('trocar a imagem pede confirmação antes de enviar', async () => {
      const post = vi.fn();
      server.use(
        http.post(`${API_URL}/questions/7/image`, () => {
          post();
          return HttpResponse.json({ image_url: '/uploads/questions/7-nova.png' });
        }),
      );
      editPage(stored({ image_url: IMAGE_PATH }));
      expect(await screen.findByRole('img', { name: 'Imagem da questão' })).toHaveAttribute('src', IMAGE_URL);

      await userEvent.upload(screen.getByLabelText('Arquivo da imagem'), pngFile());
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Trocar a imagem?')).toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Trocar' }));

      await waitFor(() =>
        expect(screen.getByRole('img', { name: 'Imagem da questão' })).toHaveAttribute(
          'src',
          'http://localhost:8000/uploads/questions/7-nova.png',
        ),
      );
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('cancelar a troca não envia nada', async () => {
      const post = vi.fn();
      server.use(
        http.post(`${API_URL}/questions/7/image`, () => {
          post();
          return HttpResponse.json({ image_url: IMAGE_PATH });
        }),
      );
      editPage(stored({ image_url: IMAGE_PATH }));
      await screen.findByRole('img', { name: 'Imagem da questão' });

      await userEvent.upload(screen.getByLabelText('Arquivo da imagem'), pngFile());
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

      expect(post).not.toHaveBeenCalled();
      expect(await screen.findByRole('img', { name: 'Imagem da questão' })).toHaveAttribute('src', IMAGE_URL);
    });

    it('remove a imagem depois de confirmar', async () => {
      const del = vi.fn();
      server.use(
        http.delete(`${API_URL}/questions/7/image`, () => {
          del();
          return new HttpResponse(null, { status: 204 });
        }),
      );
      editPage(stored({ image_url: IMAGE_PATH }));

      await userEvent.click(await screen.findByRole('button', { name: 'Remover imagem' }));
      const dialog = await screen.findByRole('dialog');
      expect(del).not.toHaveBeenCalled();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remover' }));

      expect(await screen.findByText('Imagem removida.')).toBeInTheDocument();
      expect(del).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('img', { name: 'Imagem da questão' })).toBeNull();
    });
  });
});
