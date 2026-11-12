import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { student } from 'src/test/users';
import { plan, planSummary } from 'src/features/plans/__tests__/fixtures';
import { stats } from 'src/test/studyFixtures';

const statsRoute = () => ({ status: 200, data: stats });
const planRoute = () => ({ status: 200, data: plan });

describe('tela do plano', () => {
  const open = (routes: Record<string, FakeHandler> = {}) =>
    renderApp({
      user: student,
      initialUrl: '/plans/7',
      routes: { 'GET /me/stats': statsRoute, 'GET /me/plans/7': planRoute, ...routes },
    });

  it('mostra os capítulos como páginas, com o estado de cada um', async () => {
    await open();

    expect(await screen.findByText('Frações do zero')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Capítulo 1: O que é uma fração\. Concluído\./ })).toBeTruthy();
    expect(screen.getByText('✓ 4 de 4 questões.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Capítulo 2: Frações equivalentes\. Disponível\./ })).toBeTruthy();
    expect(screen.getByText('1 de 5 questões.')).toBeTruthy();
    const locked = screen.getByRole('button', { name: /Capítulo 3: Somando frações\. Trancado\./ });
    expect(locked.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Conclua o capítulo anterior.')).toBeTruthy();
  });

  it('capítulo trancado não abre', async () => {
    const user = userEvent.setup();
    const { getPathname } = await open();

    await user.press(await screen.findByRole('button', { name: /Capítulo 3/ }));

    expect(getPathname()).toBe('/plans/7');
  });

  it('plano concluído mostra o selo "Concluído."', async () => {
    await open({
      'GET /me/plans/7': () => ({ status: 200, data: { ...plan, completed: true } }),
    });

    expect(await screen.findByText('✓ Concluído.')).toBeTruthy();
  });

  it('plano sem questões disponíveis mostra o aviso no lugar da barra e dos capítulos', async () => {
    await open({
      'GET /me/plans/7': () => ({
        status: 200,
        data: {
          ...plan,
          completed: true,
          progress: { completed_chapters: 2, total_chapters: 2, percent: 100 },
          chapters: [
            { id: 21, title: 'Vazio um', position: 1, state: 'completed', answered: 0, total: 0 },
            { id: 22, title: 'Vazio dois', position: 2, state: 'completed', answered: 0, total: 0 },
          ],
        },
      }),
    });

    expect(await screen.findByText('Este plano está sem questões disponíveis no momento.')).toBeTruthy();
    expect(screen.queryByText('0 de 0 questões.')).toBeNull();
    expect(screen.queryByText('2 de 2 capítulos.')).toBeNull();
    expect(screen.queryByText('✓ Concluído.')).toBeNull();
  });

  it('o título do plano é um cabeçalho', async () => {
    await open();

    expect(await screen.findByRole('header', { name: 'Frações do zero' })).toBeTruthy();
  });

  it('plano inexistente mostra a mensagem da API', async () => {
    await open({ 'GET /me/plans/7': () => ({ status: 404, data: { message: 'Plano não encontrado.' } }) });

    expect(await screen.findByText('Plano não encontrado.')).toBeTruthy();
  });

  it('tocar no plano abre a tela do plano', async () => {
    const user = userEvent.setup();
    const { getPathname } = await renderApp({
      user: student,
      routes: {
        'GET /me/stats': statsRoute,
        'GET /me/plans': () => ({ status: 200, data: { data: [planSummary] } }),
        'GET /me/plans/7': planRoute,
      },
    });

    await user.press(await screen.findByRole('button', { name: /Plano Frações do zero/ }));

    expect(await screen.findByText('O que é uma fração')).toBeTruthy();
    expect(getPathname()).toBe('/plans/7');
  });
});

