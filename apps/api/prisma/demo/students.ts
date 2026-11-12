/** Resultado de uma questão: acerto na 1ª, acerto na 2ª ou erro nas duas tentativas. */
export type Outcome = 'first' | 'second' | 'miss';

export interface DemoRedemption {
  reward: string;
  /** Há quantos dias o aluno resgatou (0 = hoje). */
  daysAgo: number;
  status: 'pending' | 'delivered' | 'rejected';
  /** Só para `rejected`. */
  reason?: string;
}

export interface DemoStudent {
  name: string;
  email: string;
  classroom: '9ano' | '1ser';
  /** Questões terminadas por dia: o índice é "há quantos dias" (0 = hoje, 13 = 13 dias atrás). */
  daily: readonly number[];
  /** Resultados repetidos em ciclo, na ordem em que o aluno responde. */
  pattern: readonly Outcome[];
  /** Quantas questões de cada plano o aluno faz, em ordem de capítulo, antes de praticar. */
  planQuestions: { math: number; port: number };
  redemptions: readonly DemoRedemption[];
}

export const DEMO_CLASSROOMS = [
  {
    key: '9ano',
    name: '9º ano A',
    schoolYear: '9º ano',
    joinCode: 'NIV-9ANO',
    teacher: 'ana.lima@nivela.test',
  },
  {
    key: '1ser',
    name: '1ª série B',
    schoolYear: '1ª série do Ensino Médio',
    joinCode: 'NIV-1SER',
    teacher: 'bruno.rocha@nivela.test',
  },
] as const;

export const DEMO_TEACHERS = [
  { name: 'Ana Lima', email: 'ana.lima@nivela.test' },
  { name: 'Bruno Rocha', email: 'bruno.rocha@nivela.test' },
] as const;

export const DEMO_PASSWORD = 'nivela123';

const GOOD: readonly Outcome[] = [
  'first',
  'first',
  'first',
  'second',
  'first',
  'first',
  'first',
  'miss',
];

export const DEMO_STUDENTS: readonly DemoStudent[] = [
  {
    // Estuda todos os dias (sequência de 14, dois bônus) e conclui o plano de Matemática.
    name: 'Marina Souza',
    email: 'aluno1@nivela.test',
    classroom: '9ano',
    daily: [3, 3, 3, 2, 3, 3, 3, 3, 2, 3, 3, 2, 3, 2],
    pattern: [
      'first',
      'first',
      'first',
      'second',
      'first',
      'first',
      'miss',
      'first',
    ],
    planQuestions: { math: 12, port: 4 },
    redemptions: [
      { reward: 'Caderno personalizado', daysAgo: 6, status: 'delivered' },
      { reward: '15 minutos de leitura livre', daysAgo: 1, status: 'pending' },
    ],
  },
  {
    // Sequência de 5 dias, com uma pausa no meio.
    name: 'Pedro Henrique Alves',
    email: 'aluno2@nivela.test',
    classroom: '9ano',
    daily: [2, 2, 2, 2, 2, 0, 0, 0, 2, 2, 2, 0, 0, 0],
    pattern: ['first', 'second', 'first', 'miss', 'first', 'second'],
    planQuestions: { math: 5, port: 4 },
    redemptions: [
      {
        reward: '15 minutos de leitura livre',
        daysAgo: 3,
        status: 'delivered',
      },
    ],
  },
  {
    // Estudou nove dias seguidos até ontem (bônus de 7 dias).
    name: 'Júlia Fernandes',
    email: 'aluno3@nivela.test',
    classroom: '9ano',
    daily: [0, 3, 2, 3, 2, 3, 2, 2, 3, 2, 0, 0, 0, 0],
    pattern: ['first', 'first', 'second', 'first', 'miss', 'first', 'first'],
    planQuestions: { math: 8, port: 4 },
    redemptions: [],
  },
  {
    // Acerto abaixo de 50% com 13 questões terminadas: aparece em "Precisam de ajuda".
    name: 'Gabriel Martins',
    email: 'aluno4@nivela.test',
    classroom: '9ano',
    daily: [0, 0, 3, 3, 2, 3, 2, 0, 0, 0, 0, 0, 0, 0],
    pattern: ['miss', 'miss', 'second', 'miss', 'first', 'miss'],
    planQuestions: { math: 6, port: 0 },
    redemptions: [],
  },
  {
    // Sequência de 8 dias até hoje, com os três estados de resgate.
    name: 'Beatriz Carvalho',
    email: 'aluno5@nivela.test',
    classroom: '1ser',
    daily: [3, 2, 3, 3, 2, 3, 2, 3, 0, 0, 0, 0, 0, 0],
    pattern: GOOD,
    planQuestions: { math: 9, port: 0 },
    redemptions: [
      { reward: 'Vale-lanche da cantina', daysAgo: 4, status: 'delivered' },
      {
        reward: 'Adesivos do Rabisco',
        daysAgo: 2,
        status: 'rejected',
        reason: 'O modelo escolhido acabou. Resgate novamente em alguns dias.',
      },
      { reward: 'Kit marca-texto', daysAgo: 1, status: 'pending' },
    ],
  },
  {
    name: 'Rafael Nogueira',
    email: 'aluno6@nivela.test',
    classroom: '1ser',
    daily: [2, 0, 3, 2, 0, 2, 2, 0, 3, 0, 0, 0, 0, 0],
    pattern: ['first', 'second', 'miss', 'first', 'first', 'miss'],
    planQuestions: { math: 7, port: 0 },
    redemptions: [
      { reward: 'Vale-lanche da cantina', daysAgo: 1, status: 'pending' },
    ],
  },
  {
    // Só estudou no começo do período.
    name: 'Larissa Mendes',
    email: 'aluno7@nivela.test',
    classroom: '1ser',
    daily: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3],
    pattern: ['first', 'first', 'second', 'first', 'miss', 'first'],
    planQuestions: { math: 6, port: 0 },
    redemptions: [
      { reward: 'Adesivos do Rabisco', daysAgo: 10, status: 'delivered' },
    ],
  },
  {
    // Acabou de começar.
    name: 'Thiago Barbosa',
    email: 'aluno8@nivela.test',
    classroom: '1ser',
    daily: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pattern: ['second', 'first'],
    planQuestions: { math: 2, port: 0 },
    redemptions: [],
  },
];
