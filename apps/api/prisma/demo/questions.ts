// Questões originais de demonstração, escritas para o nivelamento do 9º ano
// para o Ensino Médio. `correct` é o índice (0 a 4) da alternativa certa.
export type DemoSubject = 'Matemática' | 'Português';
export type DemoDifficulty = 'easy' | 'medium' | 'hard';

export interface DemoQuestion {
  subject: DemoSubject;
  category: string;
  difficulty: DemoDifficulty;
  statement: string;
  options: readonly [string, string, string, string, string];
  correct: 0 | 1 | 2 | 3 | 4;
  explanation: string;
}

export const DEMO_SUBJECTS = [
  { name: 'Matemática', color: 'teal', icon: 'calculator' },
  { name: 'Português', color: 'violet', icon: 'book' },
] as const;

export const DEMO_CATEGORIES: Record<DemoSubject, readonly string[]> = {
  Matemática: ['Frações', 'Equações do 1º grau', 'Porcentagem'],
  Português: ['Interpretação de texto', 'Ortografia', 'Concordância'],
};

export const DEMO_QUESTIONS: readonly DemoQuestion[] = [
  // Matemática — Frações
  {
    subject: 'Matemática',
    category: 'Frações',
    difficulty: 'easy',
    statement:
      'Uma pizza foi dividida em 8 fatias iguais. Ana comeu 3 fatias e Bruno comeu 2. Que fração da pizza sobrou?',
    options: ['5/8', '3/8', '2/8', '1/8', '3/5'],
    correct: 1,
    explanation:
      'Os dois comeram 3 + 2 = 5 fatias de 8. Sobraram 8 − 5 = 3 fatias, ou seja, 3/8 da pizza.',
  },
  {
    subject: 'Matemática',
    category: 'Frações',
    difficulty: 'medium',
    statement: 'Qual é o resultado de 2/3 + 1/4?',
    options: ['3/7', '3/12', '7/12', '11/12', '2/12'],
    correct: 3,
    explanation:
      'Com denominador comum 12: 2/3 = 8/12 e 1/4 = 3/12. Somando, 8/12 + 3/12 = 11/12.',
  },
  {
    subject: 'Matemática',
    category: 'Frações',
    difficulty: 'medium',
    statement: 'Quanto vale 3/4 × 2/5?',
    options: ['5/9', '3/20', '6/9', '8/15', '3/10'],
    correct: 4,
    explanation:
      'Multiplicam-se numeradores e denominadores: (3 × 2)/(4 × 5) = 6/20, que simplificada por 2 dá 3/10.',
  },
  {
    subject: 'Matemática',
    category: 'Frações',
    difficulty: 'hard',
    statement:
      'Uma torneira enche 1/3 de um tanque em 1 hora. Mantendo o mesmo ritmo, quanto tempo ela leva para encher 3/4 do tanque?',
    options: ['2 h 15 min', '1 h 15 min', '2 h', '2 h 30 min', '3 h'],
    correct: 0,
    explanation:
      'O tempo é (3/4) ÷ (1/3) = 3/4 × 3 = 9/4 de hora, isto é, 2 horas e 1/4 de hora, que são 2 h 15 min.',
  },
  // Matemática — Equações do 1º grau
  {
    subject: 'Matemática',
    category: 'Equações do 1º grau',
    difficulty: 'easy',
    statement: 'Qual é o valor de x na equação 3x + 5 = 20?',
    options: ['3', '4', '5', '6', '8'],
    correct: 2,
    explanation:
      'Subtraindo 5 dos dois lados: 3x = 15. Dividindo por 3: x = 5.',
  },
  {
    subject: 'Matemática',
    category: 'Equações do 1º grau',
    difficulty: 'medium',
    statement: 'Resolva a equação 2(x − 3) = x + 4.',
    options: ['−2', '1', '7', '10', '14'],
    correct: 3,
    explanation:
      'Distribuindo: 2x − 6 = x + 4. Passando x para a esquerda e 6 para a direita: x = 10. Conferindo: 2 × 7 = 14 = 10 + 4.',
  },
  {
    subject: 'Matemática',
    category: 'Equações do 1º grau',
    difficulty: 'medium',
    statement:
      'Pedro pensou em um número, multiplicou por 4 e subtraiu 7, obtendo 25. Em qual número ele pensou?',
    options: ['6', '7', '9', '18', '8'],
    correct: 4,
    explanation:
      'A equação é 4x − 7 = 25. Então 4x = 32 e x = 8. Conferindo: 4 × 8 − 7 = 25.',
  },
  {
    subject: 'Matemática',
    category: 'Equações do 1º grau',
    difficulty: 'hard',
    statement:
      'A soma de três números inteiros consecutivos é 87. Qual é o maior deles?',
    options: ['28', '30', '29', '31', '32'],
    correct: 1,
    explanation:
      'Chamando os números de n, n + 1 e n + 2, temos 3n + 3 = 87, então n = 28. Os números são 28, 29 e 30, e o maior é 30.',
  },
  // Matemática — Porcentagem
  {
    subject: 'Matemática',
    category: 'Porcentagem',
    difficulty: 'easy',
    statement: 'Quanto é 20% de 150?',
    options: ['30', '15', '20', '25', '35'],
    correct: 0,
    explanation: '20% = 20/100 = 0,2. Então 0,2 × 150 = 30.',
  },
  {
    subject: 'Matemática',
    category: 'Porcentagem',
    difficulty: 'medium',
    statement:
      'Uma camiseta custava R$ 80,00 e recebeu desconto de 15%. Qual é o novo preço?',
    options: ['R$ 12,00', 'R$ 65,00', 'R$ 68,00', 'R$ 72,00', 'R$ 95,00'],
    correct: 2,
    explanation:
      'O desconto é 15% de 80 = R$ 12,00. O novo preço é 80 − 12 = R$ 68,00 (ou 0,85 × 80).',
  },
  {
    subject: 'Matemática',
    category: 'Porcentagem',
    difficulty: 'medium',
    statement:
      'O preço de um caderno subiu de R$ 20,00 para R$ 25,00. Qual foi o aumento percentual?',
    options: ['5%', '20%', '30%', '125%', '25%'],
    correct: 4,
    explanation:
      'O aumento foi de R$ 5,00 sobre o preço original de R$ 20,00: 5/20 = 0,25, ou seja, 25%.',
  },
  {
    subject: 'Matemática',
    category: 'Porcentagem',
    difficulty: 'hard',
    statement:
      'Um produto sofreu dois aumentos seguidos de 10%. Em relação ao preço original, o aumento total foi de:',
    options: ['20%', '21%', '22%', '25%', '10,5%'],
    correct: 1,
    explanation:
      'Cada aumento multiplica o preço por 1,10. Os dois juntos: 1,10 × 1,10 = 1,21, isto é, 21% de aumento (e não 20%).',
  },
  // Português — Interpretação de texto
  {
    subject: 'Português',
    category: 'Interpretação de texto',
    difficulty: 'easy',
    statement:
      'Leia: "Todos os dias, Clara chegava cedo à biblioteca da escola. Ela dizia que o silêncio dali a ajudava a pensar. Quando as provas se aproximaram, os colegas passaram a procurá-la para estudar em grupo." Segundo o texto, por que Clara gostava da biblioteca?',
    options: [
      'Porque lá encontrava os colegas.',
      'Porque o silêncio a ajudava a pensar.',
      'Porque os livros eram novos.',
      'Porque as provas aconteciam lá.',
      'Porque ficava perto da casa dela.',
    ],
    correct: 1,
    explanation:
      'O próprio texto informa: ela dizia que o silêncio da biblioteca a ajudava a pensar. Os colegas só passaram a procurá-la depois, perto das provas.',
  },
  {
    subject: 'Português',
    category: 'Interpretação de texto',
    difficulty: 'easy',
    statement:
      'Leia: "Quando as provas se aproximaram, os colegas passaram a procurá-la para estudar em grupo." A expressão "passaram a procurá-la" indica que os colegas:',
    options: [
      'deixaram de procurá-la.',
      'procuraram Clara uma única vez.',
      'começaram a procurá-la com frequência.',
      'nunca precisaram dela.',
      'foram procurados por ela.',
    ],
    correct: 2,
    explanation:
      '"Passar a" + verbo no infinitivo indica o início de uma ação nova: antes não a procuravam, depois passaram a procurá-la.',
  },
  {
    subject: 'Português',
    category: 'Interpretação de texto',
    difficulty: 'medium',
    statement:
      'Leia: "A cidade ficou em silêncio quando as luzes se apagaram. Só se ouvia o vento nas folhas e, ao longe, o latido de um cachorro." O clima criado pelo trecho é de:',
    options: [
      'euforia e comemoração.',
      'humor e brincadeira.',
      'pressa e confusão.',
      'quietude com um toque de mistério.',
      'raiva e discussão.',
    ],
    correct: 3,
    explanation:
      'O silêncio, a escuridão e os poucos sons ao longe (vento e latido) criam um ambiente quieto e misterioso.',
  },
  {
    subject: 'Português',
    category: 'Interpretação de texto',
    difficulty: 'hard',
    statement:
      'Leia: "Na reunião, o diretor elogiou o esforço de todos e, por fim, disse que \'infelizmente nem todos os projetos poderão continuar\'. Os rostos na sala mudaram de cor." O que o trecho sugere?',
    options: [
      'Todos os projetos continuariam.',
      'Alguns projetos seriam encerrados, causando preocupação.',
      'O diretor elogiou apenas um projeto.',
      'A reunião foi cancelada.',
      'Todos ficaram satisfeitos com o resultado.',
    ],
    correct: 1,
    explanation:
      'A frase "nem todos poderão continuar" revela que alguns projetos acabarão, e a mudança nos rostos mostra a preocupação, sem que o texto diga isso explicitamente (inferência).',
  },
  // Português — Ortografia
  {
    subject: 'Português',
    category: 'Ortografia',
    difficulty: 'easy',
    statement:
      'Complete a frase: "Na ______-feira haverá simulado de Português."',
    options: ['cexta', 'sesta', 'sexta', 'secsta', 'cesta'],
    correct: 2,
    explanation:
      'O dia da semana se escreve "sexta-feira", com x. "Sesta" é um cochilo depois do almoço e "cesta" é um cesto.',
  },
  {
    subject: 'Português',
    category: 'Ortografia',
    difficulty: 'medium',
    statement: 'Em qual alternativa o uso de "mas" e "mais" está correto?',
    options: [
      'Ele estudou bastante, mais não passou.',
      'Preciso de mas tempo para terminar.',
      'Ela queria sair, mas começou a chover.',
      'Eu quero mas água, por favor.',
      'Não gosto de chuva, mais hoje gostei.',
    ],
    correct: 2,
    explanation:
      '"Mas" é conjunção e indica oposição (equivale a "porém"). "Mais" indica quantidade ou intensidade. Só a terceira frase usa a conjunção no lugar certo.',
  },
  {
    subject: 'Português',
    category: 'Ortografia',
    difficulty: 'medium',
    statement:
      'Assinale a alternativa em que todas as palavras estão escritas corretamente.',
    options: [
      'beneficiente, privilégio, exceção',
      'beneficente, previlégio, exceção',
      'beneficente, privilégio, excessão',
      'benefisente, privilégio, exceção',
      'beneficente, privilégio, exceção',
    ],
    correct: 4,
    explanation:
      'A grafia correta é "beneficente" (e não "beneficiente" nem "benefisente"), "privilégio" (e não "previlégio") e "exceção" (e não "excessão").',
  },
  {
    subject: 'Português',
    category: 'Ortografia',
    difficulty: 'hard',
    statement:
      'Em qual alternativa o emprego de "por que" e "porque" está correto?',
    options: [
      'Não sei porque ele faltou.',
      'Por que você não veio ontem?',
      'Você não veio. Porque?',
      'Ele faltou por que estava doente.',
      'O porque da briga ninguém sabe.',
    ],
    correct: 1,
    explanation:
      'Em perguntas diretas ("Por que você não veio?") e indiretas ("Não sei por que ele faltou") usa-se "por que", separado; por isso a primeira alternativa, uma pergunta indireta, está errada. "Porque" (junto) introduz uma explicação, como em "faltou porque estava doente". No fim da frase escreve-se "por quê" e, como substantivo, "porquê", com acento.',
  },
  // Português — Concordância
  {
    subject: 'Português',
    category: 'Concordância',
    difficulty: 'easy',
    statement: 'Assinale a frase com a concordância verbal correta.',
    options: [
      'Os alunos chegou cedo.',
      'As meninas chegaram cedo.',
      'Nós foi ao museu ontem.',
      'Eles vai à escola de bicicleta.',
      'Os livros está sobre a mesa.',
    ],
    correct: 1,
    explanation:
      'O verbo concorda com o sujeito em número e pessoa: "As meninas" (3ª pessoa do plural) pede "chegaram".',
  },
  {
    subject: 'Português',
    category: 'Concordância',
    difficulty: 'medium',
    statement:
      'Qual frase está de acordo com a norma-padrão quanto ao verbo "haver"?',
    options: [
      'Haviam muitos alunos na sala.',
      'Devem haver erros no texto.',
      'Houve muitos problemas na prova.',
      'Hão muitas pessoas esperando na fila.',
      'Existe vários caminhos para a escola.',
    ],
    correct: 2,
    explanation:
      'No sentido de "existir" ou "ocorrer", "haver" é impessoal e fica no singular: "Houve muitos problemas". Em "Haviam muitos alunos" e "Hão muitas pessoas" o verbo foi para o plural (o certo é "Havia" e "Há"). Em "Devem haver erros", quem está mal flexionado é o auxiliar "dever", que acompanha o impessoal: "Deve haver erros". E "Existe vários caminhos" erra porque "existir" concorda com o sujeito ("Existem").',
  },
  {
    subject: 'Português',
    category: 'Concordância',
    difficulty: 'hard',
    statement:
      'Assinale a alternativa em que a concordância nominal está correta.',
    options: [
      'Os alunos ficaram meio nervoso.',
      'As meninas estavam bastantes cansadas.',
      'Elas ficaram meio cansadas.',
      'Elas ficaram meias cansadas.',
      'Ela mesmo resolveu o problema.',
    ],
    correct: 2,
    explanation:
      '"Meio", com sentido de "um pouco", é advérbio e não varia, enquanto "cansadas" é adjetivo e concorda com "elas". Por isso "meio nervoso" está errado: o adjetivo deve concordar com "os alunos" ("meio nervosos"). "Bastante" advérbio também não varia, e "mesmo" concorda com o sujeito ("ela mesma").',
  },
  {
    subject: 'Português',
    category: 'Concordância',
    difficulty: 'easy',
    statement:
      'Complete a frase: "Os resultados da prova ______ divulgados amanhã."',
    options: ['será', 'foi', 'é', 'serias', 'serão'],
    correct: 4,
    explanation:
      'O sujeito "os resultados" está no plural, então o verbo também fica no plural: "serão divulgados".',
  },
];
