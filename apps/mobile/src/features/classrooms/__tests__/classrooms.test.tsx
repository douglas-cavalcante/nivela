import { screen, userEvent } from '@testing-library/react-native';
import { networkError, renderApp } from 'src/test/render';
import { student } from 'src/test/users';
import type { ApiMyClassroom } from '@nivela/api-contract';

const sexto: ApiMyClassroom = {
  id: 1,
  name: '6º A',
  school_year: '2026',
  teacher: { name: 'Carla Dias' },
  joined_at: '2026-03-01T10:00:00.000Z',
};
const setimo: ApiMyClassroom = {
  id: 2,
  name: '7º B',
  school_year: '2026',
  teacher: { name: 'Paulo Lima' },
  joined_at: '2026-03-02T10:00:00.000Z',
};

// O perfil também carrega o cartão de moedas.
const coinRoutes = {
  'GET /me/stats': () => ({ status: 200, data: { coins_balance: 0, current_streak: 0, best_streak: 0 } }),
  'GET /me/coins': () => ({ status: 200, data: { data: [], meta: { page: 1, per_page: 3, total: 0, last_page: 1 } } }),
};

const list = (data: ApiMyClassroom[]) => () => ({ status: 200, data: { data } });

describe('turmas do aluno no perfil', () => {
  it('lista as turmas com ano e professor', async () => {
    await renderApp({ user: student, initialUrl: '/profile', routes: { ...coinRoutes, 'GET /me/classrooms': list([sexto]) } });

    expect(await screen.findByText('Minhas turmas')).toBeTruthy();
    expect(await screen.findByText('6º A')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.getByText('Prof. Carla Dias')).toBeTruthy();
  });

  it('enquanto a lista carrega não oferece "Entrar em outra turma"', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...coinRoutes,
        'GET /me/classrooms': async () => {
          await gate;
          return { status: 200, data: { data: [sexto] } };
        },
      },
    });

    expect(await screen.findByLabelText('Carregando turmas')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Entrar em outra turma' })).toBeNull();
    release();
    expect(await screen.findByRole('button', { name: 'Entrar em outra turma' })).toBeTruthy();
  });

  it('sem turmas mostra o estado vazio', async () => {
    await renderApp({ user: student, initialUrl: '/profile', routes: { ...coinRoutes, 'GET /me/classrooms': list([]) } });

    expect(await screen.findByText('Você ainda não está em nenhuma turma.')).toBeTruthy();
  });

  it('sem rede mostra a mensagem e permite tentar de novo', async () => {
    let calls = 0;
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...coinRoutes, 'GET /me/classrooms': (body, config) => (calls++ === 0 ? networkError(body, config) : list([sexto])()) },
    });
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toBeTruthy();
    // Sem a lista não dá para entrar em outra turma (evita corrida com o GET inicial).
    expect(screen.queryByRole('button', { name: 'Entrar em outra turma' })).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('6º A')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar em outra turma' })).toBeTruthy();
  });

  it('entra em outra turma com o código normalizado e atualiza a lista', async () => {
    const join = jest.fn(() => ({ status: 201, data: setimo }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...coinRoutes, 'GET /me/classrooms': list([sexto]), 'POST /me/classrooms': join },
    });

    await user.press(await screen.findByRole('button', { name: 'Entrar em outra turma' }));
    expect(screen.getByText('Peça ao seu professor. Ex.: NIV-4K7Q.')).toBeTruthy();
    await user.type(screen.getByLabelText('Código da turma'), ' niv 4k7q ');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Você entrou na turma 7º B!')).toBeTruthy();
    expect(join).toHaveBeenCalledWith({ join_code: 'NIV-4K7Q' }, expect.anything());
    expect(screen.getByText('Prof. Paulo Lima')).toBeTruthy();
    expect(screen.getByText('6º A')).toBeTruthy();
    expect(screen.queryByLabelText('Código da turma')).toBeNull();
  });

  it('mostra o erro 422 no campo do código', async () => {
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...coinRoutes,
        'GET /me/classrooms': list([sexto]),
        'POST /me/classrooms': () => ({
          status: 422,
          data: { message: 'Dados inválidos.', errors: { join_code: ['Você já está nesta turma.'] } },
        }),
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Entrar em outra turma' }));
    await user.type(screen.getByLabelText('Código da turma'), 'niv-4k7q');
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Você já está nesta turma.')).toBeTruthy();
    expect(screen.queryByText(/Você entrou na turma/)).toBeNull();
  });

  it('código vazio é barrado antes de chamar a API', async () => {
    const join = jest.fn(() => ({ status: 201, data: setimo }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { ...coinRoutes, 'GET /me/classrooms': list([]), 'POST /me/classrooms': join },
    });

    await user.press(await screen.findByRole('button', { name: 'Entrar em outra turma' }));
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o código da turma.')).toBeTruthy();
    expect(join).not.toHaveBeenCalled();
  });
});
