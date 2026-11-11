import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import { student } from 'src/test/users';
import { donePlan, noDuePlan, planSummary } from 'src/features/plans/__tests__/fixtures';
import { stats } from 'src/test/studyFixtures';

const statsRoute = () => ({ status: 200, data: stats });

describe('Início: meus planos', () => {
  it('lista os planos com progresso e prazo', async () => {
    await renderApp({
      user: student,
      routes: {
        'GET /me/stats': statsRoute,
        'GET /me/plans': () => ({ status: 200, data: { data: [planSummary, noDuePlan] } }),
      },
    });

    expect(await screen.findByText('Frações do zero')).toBeTruthy();
    expect(screen.getByText('3 de 5 capítulos.')).toBeTruthy();
    expect(screen.getByText('Até 20/11.')).toBeTruthy();
    expect(screen.getByText('Verbos no passado')).toBeTruthy();
    expect(screen.getByText('0 de 2 capítulos.')).toBeTruthy();
    expect(screen.getAllByText(/^Até /)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Praticar agora' })).toBeTruthy();
  });

  it('plano concluído mostra o selo "Concluído."', async () => {
    await renderApp({
      user: student,
      routes: {
        'GET /me/stats': statsRoute,
        'GET /me/plans': () => ({ status: 200, data: { data: [donePlan] } }),
      },
    });

    expect(await screen.findByText('Geometria básica')).toBeTruthy();
    expect(screen.getByText('✓ Concluído.')).toBeTruthy();
  });

  it('sem planos mostra a mensagem de vazio', async () => {
    await renderApp({
      user: student,
      routes: { 'GET /me/stats': statsRoute, 'GET /me/plans': () => ({ status: 200, data: { data: [] } }) },
    });

    expect(await screen.findByText('Seus planos aparecem aqui quando o professor enviar.')).toBeTruthy();
  });

  it('mostra o erro da lista e permite tentar de novo', async () => {
    const replies = [
      { status: 500, data: { message: 'Algo deu errado.' } },
      { status: 200, data: { data: [planSummary] } },
    ];
    const user = userEvent.setup();
    await renderApp({
      user: student,
      routes: { 'GET /me/stats': statsRoute, 'GET /me/plans': () => replies.shift() ?? replies[0] },
    });

    expect(await screen.findByText('Algo deu errado.')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Frações do zero')).toBeTruthy();
  });
});

