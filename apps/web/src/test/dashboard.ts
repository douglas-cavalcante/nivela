import { http, HttpResponse } from 'msw';
import { API_URL, server } from 'src/test/server';

export const summary = {
  active_students: 24,
  active_questions: 130,
  accuracy: 72,
  students_needing_help: 2,
  pending_redemptions: 3,
};

/** 14 dias de atividade (01 a 14/11/2026): 2 questões terminadas por dia, 1 certa, exceto o dia 14. */
export const activity = Array.from({ length: 14 }, (_, index) => ({
  day: `2026-11-${String(index + 1).padStart(2, '0')}`,
  answered: index === 13 ? 10 : 2,
  correct: index === 13 ? 7 : 1,
}));

export const needingHelp = [
  { student: { id: 31, name: 'Bia Souza' }, accuracy: 40, finished: 10 },
  { student: { id: 32, name: 'Caio Dias' }, accuracy: 25, finished: 8 },
];

export const recentQuestions = [
  {
    id: 91,
    statement_excerpt: 'Quanto é 3/4 de 20?',
    difficulty: 'easy',
    active: true,
    has_image: false,
    subject: { id: 1, name: 'Matemática', color: 'teal' },
    category: { id: 4, name: 'Frações' },
    author: { id: 2, name: 'Paulo Professor' },
    updated_at: '2026-11-10T12:00:00.000Z',
  },
];

/** Registra as quatro rotas do Início; o que não for passado usa os dados acima. */
export function dashboardHandlers(
  overrides: Partial<Record<'summary' | 'activity' | 'needingHelp' | 'recent', unknown>> = {},
) {
  server.use(
    http.get(`${API_URL}/dashboard/summary`, () => HttpResponse.json(overrides.summary ?? summary)),
    http.get(`${API_URL}/dashboard/activity`, () => HttpResponse.json({ data: overrides.activity ?? activity })),
    http.get(`${API_URL}/dashboard/needing-help`, () =>
      HttpResponse.json({ data: overrides.needingHelp ?? needingHelp }),
    ),
    http.get(`${API_URL}/dashboard/recent-questions`, () =>
      HttpResponse.json({ data: overrides.recent ?? recentQuestions }),
    ),
  );
}
