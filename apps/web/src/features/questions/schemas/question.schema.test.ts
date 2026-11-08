import { questionSchema, toQuestionPayload } from 'src/features/questions/schemas/question.schema';

const options = ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `Texto ${letter}` }));
const valid = {
  subject_id: '1',
  category_id: '10',
  difficulty: 'medium',
  statement: 'Quanto é dois mais dois?',
  explanation: 'Soma simples.',
  options,
  correct_letter: 'C',
};

const messages = (input: unknown) => {
  const result = questionSchema.safeParse(input);
  if (result.success) return {};
  // o formulário mostra a primeira mensagem de cada campo
  const first: Record<string, string> = {};
  for (const issue of result.error.issues) first[issue.path.join('.')] ??= issue.message;
  return first;
};

describe('questionSchema', () => {
  it('aceita uma questão completa e monta o payload da API', () => {
    const parsed = questionSchema.parse({ ...valid, statement: '  Quanto é dois mais dois?  ' });
    expect(toQuestionPayload(parsed)).toEqual({
      subject_id: 1,
      category_id: 10,
      statement: 'Quanto é dois mais dois?',
      difficulty: 'medium',
      explanation: 'Soma simples.',
      options,
      correct_letter: 'C',
    });
  });

  it('usa as mesmas mensagens da API para campos vazios', () => {
    expect(
      messages({
        ...valid,
        subject_id: '',
        category_id: '',
        difficulty: '',
        statement: '',
        explanation: '  ',
        correct_letter: '',
        options: options.map((o) => ({ ...o, text: ' ' })),
      }),
    ).toEqual({
      subject_id: 'Escolha a disciplina.',
      category_id: 'Escolha a categoria.',
      difficulty: 'Escolha a dificuldade.',
      statement: 'Informe o enunciado.',
      explanation: 'Informe a explicação.',
      correct_letter: 'Escolha a alternativa correta.',
      'options.0.text': 'Informe o texto da alternativa.',
      'options.1.text': 'Informe o texto da alternativa.',
      'options.2.text': 'Informe o texto da alternativa.',
      'options.3.text': 'Informe o texto da alternativa.',
      'options.4.text': 'Informe o texto da alternativa.',
    });
  });

  it('valida limites de tamanho', () => {
    expect(messages({ ...valid, statement: 'curto' }).statement).toBe('O enunciado deve ter pelo menos 10 caracteres.');
    expect(messages({ ...valid, statement: 'x'.repeat(5001) }).statement).toBe(
      'O enunciado deve ter no máximo 5000 caracteres.',
    );
    expect(messages({ ...valid, explanation: 'x'.repeat(5001) }).explanation).toBe(
      'A explicação deve ter no máximo 5000 caracteres.',
    );
    const long = options.map((o, i) => (i === 3 ? { ...o, text: 'x'.repeat(1001) } : o));
    expect(messages({ ...valid, options: long })['options.3.text']).toBe(
      'A alternativa deve ter no máximo 1000 caracteres.',
    );
  });

  it('exige exatamente 5 alternativas', () => {
    expect(messages({ ...valid, options: options.slice(0, 4) }).options).toBe('Informe as 5 alternativas, de A a E.');
  });
});
