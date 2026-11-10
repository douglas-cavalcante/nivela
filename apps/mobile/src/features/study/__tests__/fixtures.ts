import type {
  ApiAnswerResult,
  ApiPracticeNext,
  ApiPracticeSubject,
  ApiStudentQuestion,
  ApiStudentStats,
} from '@nivela/api-contract';

export const mathSubject: ApiPracticeSubject = {
  id: 1,
  name: 'Matemática',
  color: 'teal',
  icon: 'calculator',
  available_questions: 12,
  categories: [
    { id: 10, name: 'Álgebra', available_questions: 7 },
    { id: 11, name: 'Geometria', available_questions: 1 },
  ],
};

export const historySubject: ApiPracticeSubject = {
  id: 2,
  name: 'História',
  color: 'amber',
  icon: 'book',
  available_questions: 0,
  categories: [],
};

export const question: ApiStudentQuestion = {
  id: 5,
  statement: 'Quanto é dois mais dois?',
  image_url: null,
  difficulty: 'easy',
  subject: { id: 1, name: 'Matemática', color: 'teal' },
  category: { id: 10, name: 'Álgebra' },
  options: [
    { letter: 'A', text: 'Três' },
    { letter: 'B', text: 'Quatro' },
    { letter: 'C', text: 'Cinco' },
    { letter: 'D', text: 'Seis' },
    { letter: 'E', text: 'Sete' },
  ],
  attempts_left: 2,
};

export const nextOf = (q: ApiStudentQuestion | null, remaining = 3): ApiPracticeNext => ({ question: q, remaining });

export const stats: ApiStudentStats = {
  coins_balance: 120,
  current_streak: 3,
  best_streak: 5,
};

export const correctResult: ApiAnswerResult = {
  is_correct: true,
  attempt_number: 1,
  finished: true,
  coins_awarded: 10,
  coins_balance: 130,
  correct_letter: 'B',
  explanation: 'Dois mais dois são quatro.',
  streak: { current: 4, best: 5, bonus_awarded: 0 },
};

export const firstMiss: ApiAnswerResult = {
  is_correct: false,
  attempt_number: 1,
  finished: false,
  coins_awarded: 0,
  coins_balance: 120,
  correct_letter: null,
  explanation: null,
  streak: { current: 3, best: 5, bonus_awarded: 0 },
};

export const secondMiss: ApiAnswerResult = {
  ...firstMiss,
  attempt_number: 2,
  finished: true,
  correct_letter: 'C',
  explanation: 'A resposta é cinco por causa da conta.',
};
