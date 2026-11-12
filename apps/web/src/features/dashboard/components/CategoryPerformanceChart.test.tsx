import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { CategoryPerformanceChart } from 'src/features/dashboard/components/CategoryPerformanceChart';
import { renderWithProviders } from 'src/test/render';
import { API_URL, server } from 'src/test/server';
import { teacher } from 'src/test/users';

const performance = [
  {
    category: { id: 4, name: 'Frações' },
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    finished: 4,
    correct: 3,
    accuracy: 75,
  },
  {
    category: { id: 5, name: 'Verbos' },
    subject: { id: 2, name: 'Português', color: 'coral' },
    finished: 3,
    correct: 1,
    accuracy: 33,
  },
  {
    category: { id: 6, name: 'Geometria' },
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    finished: 0,
    correct: 0,
    accuracy: null,
  },
];

describe('CategoryPerformanceChart', () => {
  it('turma: pede o desempenho da turma e mostra uma barra por categoria com "x% (c de f)."', async () => {
    server.use(http.get(`${API_URL}/classrooms/7/performance`, () => HttpResponse.json({ data: performance })));
    renderWithProviders(<CategoryPerformanceChart scope="classroom" id={7} />, { user: teacher });

    const fractions = (await screen.findByText('Frações')).closest('li') as HTMLElement;
    expect(within(fractions).getByText('Matemática')).toBeInTheDocument();
    expect(within(fractions).getByText('75% (3 de 4).')).toBeInTheDocument();
    expect(within(fractions).getByRole('progressbar', { name: 'Acerto em Frações' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    const verbs = screen.getByText('Verbos').closest('li') as HTMLElement;
    expect(within(verbs).getByText('Português')).toBeInTheDocument();
    expect(within(verbs).getByText('33% (1 de 3).')).toBeInTheDocument();
  });

  it('categoria sem questões terminadas não inventa porcentagem', async () => {
    server.use(http.get(`${API_URL}/classrooms/7/performance`, () => HttpResponse.json({ data: performance })));
    renderWithProviders(<CategoryPerformanceChart scope="classroom" id={7} />, { user: teacher });

    const geometry = (await screen.findByText('Geometria')).closest('li') as HTMLElement;
    expect(within(geometry).getByText('Sem questões terminadas.')).toBeInTheDocument();
    expect(within(geometry).queryByRole('progressbar')).toBeNull();
  });

  it('aluno: pede o desempenho do aluno', async () => {
    server.use(http.get(`${API_URL}/students/21/performance`, () => HttpResponse.json({ data: performance })));
    renderWithProviders(<CategoryPerformanceChart scope="student" id={21} />, { user: teacher });

    expect(await screen.findByText('75% (3 de 4).')).toBeInTheDocument();
  });

  it('sem dados mostra o texto de vazio', async () => {
    server.use(http.get(`${API_URL}/students/21/performance`, () => HttpResponse.json({ data: [] })));
    renderWithProviders(<CategoryPerformanceChart scope="student" id={21} />, { user: teacher });

    expect(await screen.findByText('Ainda não há respostas terminadas.')).toBeInTheDocument();
  });

  it('falha mostra o erro e "Tentar de novo" recarrega', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/classrooms/7/performance`, () =>
        ++calls === 1 ? HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }) : HttpResponse.json({ data: performance }),
      ),
    );
    renderWithProviders(<CategoryPerformanceChart scope="classroom" id={7} />, { user: teacher });

    expect(await screen.findByRole('heading', { name: 'Não deu para carregar.' })).toBeInTheDocument();
    expect(screen.getByText('Erro interno.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('75% (3 de 4).')).toBeInTheDocument();
  });
});
