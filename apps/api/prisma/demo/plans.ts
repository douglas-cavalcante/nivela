import type { DemoSubject } from './questions';

export interface DemoPlan {
  key: 'math' | 'port';
  subject: DemoSubject;
  title: string;
  description: string;
  completionBonus: number;
  /** Capítulos na ordem; cada um usa as 4 questões da categoria. */
  chapters: readonly { title: string; category: string }[];
  /** Turmas (chave de `DEMO_CLASSROOMS`) que recebem o plano. */
  classrooms: readonly ('9ano' | '1ser')[];
}

export const DEMO_PLANS: readonly DemoPlan[] = [
  {
    key: 'math',
    subject: 'Matemática',
    title: 'Revisão de Matemática para o Ensino Médio',
    description:
      'Frações, equações do 1º grau e porcentagem: a base para começar o Ensino Médio.',
    completionBonus: 50,
    chapters: [
      { title: 'Frações', category: 'Frações' },
      { title: 'Equações do 1º grau', category: 'Equações do 1º grau' },
      { title: 'Porcentagem', category: 'Porcentagem' },
    ],
    classrooms: ['9ano', '1ser'],
  },
  {
    key: 'port',
    subject: 'Português',
    title: 'Leitura e escrita',
    description: 'Leitura atenta de textos curtos e concordância na prática.',
    completionBonus: 30,
    chapters: [
      { title: 'Interpretação de texto', category: 'Interpretação de texto' },
      { title: 'Concordância', category: 'Concordância' },
    ],
    classrooms: ['9ano'],
  },
];
