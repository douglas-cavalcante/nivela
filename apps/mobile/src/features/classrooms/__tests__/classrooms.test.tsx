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

const list = (data: ApiMyClassroom[]) => () => ({ status: 200, data: { data } });

describe('turmas do aluno no perfil', () => {
  it('lista as turmas com ano e professor', async () => {
    await renderApp({ user: student, initialUrl: '/profile', routes: { 'GET /me/classrooms': list([sexto]) } });

    expect(await screen.findByText('Minhas turmas')).toBeTruthy();
    expect(await screen.findByText('6º A')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.getByText('Prof. Carla Dias')).toBeTruthy();
  });

  it('sem turmas mostra o estado vazio', async () => {
    await renderApp({ user: student, initialUrl: '/profile', routes: { 'GET /me/classrooms': list([]) } });

    expect(await screen.findByText('Você ainda não está em nenhuma turma.')).toBeTruthy();
  });

  it('sem rede mostra a mensagem e permite tentar de novo', async () => {
    let calls = 0;
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { 'GET /me/classrooms': (body, config) => (calls++ === 0 ? networkError(body, config) : list([sexto])()) },
    });
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('6º A')).toBeTruthy();
  });

  it('entra em outra turma com o código normalizado e atualiza a lista', async () => {
    const join = jest.fn(() => ({ status: 201, data: setimo }));
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/profile',
      routes: { 'GET /me/classrooms': list([sexto]), 'POST /me/classrooms': join },
    });

    await user.press(await screen.findByRole('button', { name: 'Entrar em outra turma' }));
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
      routes: {
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
      routes: { 'GET /me/classrooms': list([]), 'POST /me/classrooms': join },
    });

    await user.press(await screen.findByRole('button', { name: 'Entrar em outra turma' }));
    await user.press(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o código da turma.')).toBeTruthy();
    expect(join).not.toHaveBeenCalled();
  });
});
