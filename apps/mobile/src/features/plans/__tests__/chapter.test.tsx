import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { student } from 'src/test/users';
import {
  chapterNext,
  correctResult,
  firstMiss,
  nextOf,
  plan,
  question,
  stats,
} from 'src/features/plans/__tests__/fixtures';

const statsRoute = () => ({ status: 200, data: stats });
const planRoute = () => ({ status: 200, data: plan });

describe('abrindo capítulos pelo plano', () => {
  const open = (routes: Record<string, FakeHandler> = {}) =>
    renderApp({
      user: student,
      initialUrl: '/plans/7',
      routes: { 'GET /me/stats': statsRoute, 'GET /me/plans/7': planRoute, ...routes },
    });

  it('capítulo disponível abre a questão', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open({
      'GET /me/plans/7/chapters/22/next': () => ({ status: 200, data: chapterNext() }),
    });

    await user.press(await screen.findByRole('button', { name: /Capítulo 2/ }));

    expect(await screen.findByText('Quanto é dois mais dois?')).toBeTruthy();
    expect(getPathname()).toBe('/plans/7/chapters/22');
  });

  it('capítulo concluído também abre', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open({
      'GET /me/plans/7/chapters/21/next': () => ({ status: 200, data: chapterNext() }),
    });

    await user.press(await screen.findByRole('button', { name: /Capítulo 1/ }));

    expect(await screen.findByText('Quanto é dois mais dois?')).toBeTruthy();
    expect(getPathname()).toBe('/plans/7/chapters/21');
  });
});

describe('estudando um capítulo', () => {
  const open = (routes: Record<string, FakeHandler> = {}) =>
    renderApp({
      user: student,
      initialUrl: '/plans/7/chapters/22',
      routes: {
        'GET /me/stats': statsRoute,
        'GET /me/plans/7': planRoute,
        'GET /me/plans/7/chapters/22/next': () => ({ status: 200, data: chapterNext() }),
        ...routes,
      },
    });

  const answerB = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.press(await screen.findByRole('radio', { name: 'Alternativa B: Quatro' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));
  };

  it('envia a resposta com plan_chapter_id', async () => {
    const answer = jest.fn(() => ({ status: 200, data: correctResult }));
    const user = userEvent.setup();
    await open({ 'POST /answers': answer });

    await answerB(user);

    expect(await screen.findByText('Isso aí!')).toBeTruthy();
    expect(answer).toHaveBeenCalledWith(
      { question_id: 5, selected_letter: 'B', plan_chapter_id: 22 },
      expect.anything(),
    );
    expect(screen.queryByText('Capítulo concluído!')).toBeNull();
  });

  it('errar na 1ª tentativa deixa tentar de novo a mesma questão', async () => {
    const user = userEvent.setup();
    await open({ 'POST /answers': () => ({ status: 200, data: firstMiss }) });

    await user.press(await screen.findByRole('radio', { name: 'Alternativa A: Três' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));
    await user.press(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(screen.getByText('Última tentativa.')).toBeTruthy();
  });

  it('"Próxima" busca a próxima questão do capítulo', async () => {
    const second = { ...question, id: 6, statement: 'Quanto é três vezes três?' };
    const queue = [chapterNext(), { question: second, remaining: 3 }];
    const user = userEvent.setup();
    await open({
      'GET /me/plans/7/chapters/22/next': () => ({ status: 200, data: queue.shift() }),
      'POST /answers': () => ({ status: 200, data: correctResult }),
    });

    await answerB(user);
    await user.press(await screen.findByRole('button', { name: 'Próxima' }));

    expect(await screen.findByText('Quanto é três vezes três?')).toBeTruthy();
  });

  it('capítulo concluído mostra a mensagem e leva ao próximo capítulo', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open({
      'GET /me/plans/7/chapters/23/next': () => ({ status: 200, data: chapterNext() }),
      'POST /answers': () => ({
        status: 200,
        data: {
          ...correctResult,
          chapter: { completed: true, next_chapter_id: 23 },
          plan: { completed: false, bonus_awarded: 0 },
        },
      }),
    });

    await answerB(user);

    expect(await screen.findByText('Capítulo concluído!')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Próximo capítulo' }));
    expect(await screen.findByText('Quanto é dois mais dois?')).toBeTruthy();
    expect(getPathname()).toBe('/plans/7/chapters/23');
  });

  it('capítulo concluído sem próximo capítulo volta ao plano', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open({
      'POST /answers': () => ({
        status: 200,
        data: {
          ...correctResult,
          chapter: { completed: true, next_chapter_id: null },
          plan: { completed: false, bonus_awarded: 0 },
        },
      }),
    });

    await answerB(user);
    await user.press(await screen.findByRole('button', { name: 'Voltar ao plano' }));

    expect(await screen.findByText('Somando frações')).toBeTruthy();
    expect(getPathname()).toBe('/plans/7');
  });

  it('plano concluído mostra o bônus e volta ao início', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open({
      'GET /me/plans': () => ({ status: 200, data: { data: [] } }),
      'POST /answers': () => ({
        status: 200,
        data: {
          ...correctResult,
          chapter: { completed: true, next_chapter_id: null },
          plan: { completed: true, bonus_awarded: 50 },
        },
      }),
    });

    await answerB(user);

    expect(await screen.findByText('Plano concluído!')).toBeTruthy();
    expect(screen.getByText('+50 🪙.')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Voltar ao início' }));
    expect(await screen.findByText('Seus planos aparecem aqui quando o professor enviar.')).toBeTruthy();
    expect(getPathname()).toBe('/');
  });

  it('plano concluído sem bônus não mostra moedas', async () => {
    const user = userEvent.setup();
    await open({
      'POST /answers': () => ({
        status: 200,
        data: {
          ...correctResult,
          coins_awarded: 0,
          chapter: { completed: true, next_chapter_id: null },
          plan: { completed: true, bonus_awarded: 0 },
        },
      }),
    });

    await answerB(user);

    expect(await screen.findByText('Plano concluído!')).toBeTruthy();
    expect(screen.queryByText(/^\+\d+ 🪙\.$/)).toBeNull();
  });

  it('capítulo trancado (409) mostra a mensagem da API', async () => {
    const user = userEvent.setup();
    await open({
      'GET /me/plans/7/chapters/22/next': () => ({
        status: 409,
        data: { message: 'Conclua o capítulo anterior para liberar este.' },
      }),
      'GET /me/plans/7': planRoute,
    });

    expect(await screen.findByText('Conclua o capítulo anterior para liberar este.')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar ao plano' })).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Voltar ao plano' }));
    expect(await screen.findByText('Somando frações')).toBeTruthy();
  });

  it('capítulo inexistente (404) mostra a mensagem da API', async () => {
    await open({
      'GET /me/plans/7/chapters/22/next': () => ({ status: 404, data: { message: 'Capítulo não encontrado.' } }),
    });

    expect(await screen.findByText('Capítulo não encontrado.')).toBeTruthy();
  });

  it('sem questão no capítulo mostra que ele está feito', async () => {
    await open({ 'GET /me/plans/7/chapters/22/next': () => ({ status: 200, data: nextOf(null, 0) }) });

    expect(await screen.findByText('Você terminou este capítulo!')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voltar ao plano' })).toBeTruthy();
  });

  it('resposta 409 (questão já terminada) avisa e carrega a próxima', async () => {
    const second = { ...question, id: 6, statement: 'Quanto é três vezes três?' };
    const queue = [chapterNext(), { question: second, remaining: 3 }];
    const user = userEvent.setup();
    await open({
      'GET /me/plans/7/chapters/22/next': () => ({ status: 200, data: queue.shift() }),
      'POST /answers': () => ({ status: 409, data: { message: 'Você já terminou esta questão.' } }),
    });

    await answerB(user);

    expect(await screen.findByText('Quanto é três vezes três?')).toBeTruthy();
    expect(screen.getByText('Você já terminou esta questão.')).toBeTruthy();
  });
});
