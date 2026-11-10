import { screen, userEvent } from '@testing-library/react-native';
import { renderApp } from 'src/test/render';
import type { FakeHandler } from 'src/test/render';
import { expectParams } from 'src/test/expectParams';
import { student } from 'src/test/users';
import {
  correctResult,
  firstMiss,
  historySubject,
  mathSubject,
  nextOf,
  question,
  secondMiss,
  stats,
} from 'src/features/study/__tests__/fixtures';

type RequestConfig = Parameters<FakeHandler>[1];

const subjects = () => ({ status: 200, data: { data: [mathSubject, historySubject] } });
const statsRoute = () => ({ status: 200, data: stats });

describe('aba Estudar', () => {
  it('lista as disciplinas com a quantidade de questões', async () => {
    await renderApp({
      user: student,
      initialUrl: '/study',
      routes: { 'GET /practice/subjects': subjects, 'GET /me/stats': statsRoute },
    });

    expect(await screen.findByText('Matemática')).toBeTruthy();
    expect(screen.getByText('12 questões para praticar.')).toBeTruthy();
    expect(screen.getByText('História')).toBeTruthy();
    expect(screen.getByText('Você praticou tudo por aqui.')).toBeTruthy();
  });

  it('abre a prática da disciplina buscando a próxima questão com subject_id', async () => {
    const next = jest.fn((_body: Record<string, unknown>, config: RequestConfig) => {
      expectParams(config, { subject_id: 1 });
      return { status: 200, data: nextOf(question) };
    });
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/study',
      routes: {
        'GET /practice/subjects': subjects,
        'GET /me/stats': statsRoute,
        'GET /practice/next': next,
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Praticar Matemática' }));
    await user.press(await screen.findByRole('button', { name: 'Todas as categorias' }));

    expect(await screen.findByText('Quanto é dois mais dois?')).toBeTruthy();
    expect(next).toHaveBeenCalled();
  });

  it('escolhendo uma categoria, envia category_id', async () => {
    const next = jest.fn((_body: Record<string, unknown>, config: RequestConfig) => {
      expectParams(config, { subject_id: 1, category_id: 10 });
      return { status: 200, data: nextOf(question) };
    });
    const user = userEvent.setup();
    await renderApp({
      user: student,
      initialUrl: '/study',
      routes: {
        'GET /practice/subjects': subjects,
        'GET /me/stats': statsRoute,
        'GET /practice/next': next,
      },
    });

    await user.press(await screen.findByRole('button', { name: 'Praticar Matemática' }));
    expect(screen.getByText('7 questões.')).toBeTruthy();
    expect(screen.getByText('1 questão.')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Álgebra' }));

    expect(await screen.findByText('Quanto é dois mais dois?')).toBeTruthy();
    expect(next).toHaveBeenCalled();
  });
});

describe('prática livre', () => {
  const open = (routes: Record<string, FakeHandler>) =>
    renderApp({
      user: student,
      initialUrl: '/practice/1',
      routes: { 'GET /me/stats': statsRoute, ...routes },
    });

  it('responde enviando question_id e a letra; o acerto mostra moedas e explicação', async () => {
    const answer = jest.fn(() => ({ status: 200, data: correctResult }));
    const user = userEvent.setup();
    await open({ 'GET /practice/next': () => ({ status: 200, data: nextOf(question) }), 'POST /answers': answer });

    const optionB = await screen.findByRole('radio', { name: 'Alternativa B: Quatro' });
    expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
    expect(optionB.props.accessibilityState).toMatchObject({ checked: false });
    await user.press(optionB);
    expect(screen.getByRole('radio', { name: 'Alternativa B: Quatro' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await user.press(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByText('Isso aí!')).toBeTruthy();
    expect(screen.getByText('+10 🪙')).toBeTruthy();
    expect(screen.getByText('Dois mais dois são quatro.')).toBeTruthy();
    expect(answer).toHaveBeenCalledWith({ question_id: 5, selected_letter: 'B' }, expect.anything());
    // a barra de moedas e sequência acompanha o resultado
    expect(screen.getByLabelText('130 moedas.')).toBeTruthy();
    expect(screen.getByLabelText('Sequência de 4 dias.')).toBeTruthy();
  });

  it('errar na 1ª tentativa não revela a resposta e deixa tentar de novo', async () => {
    const answers = [firstMiss, secondMiss];
    const user = userEvent.setup();
    await open({
      'GET /practice/next': () => ({ status: 200, data: nextOf(question) }),
      'POST /answers': () => ({ status: 200, data: answers.shift() }),
    });

    await user.press(await screen.findByRole('radio', { name: 'Alternativa A: Três' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByText('Quase! Tente de novo.')).toBeTruthy();
    expect(screen.queryByText(/Resposta:/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Próxima' })).toBeNull();

    await user.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.getByText('Última tentativa.')).toBeTruthy();
    await user.press(await screen.findByRole('radio', { name: 'Alternativa A: Três' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));

    // 2ª tentativa errada: agora a resposta aparece, com a explicação
    expect(await screen.findByText('Resposta: C')).toBeTruthy();
    expect(screen.getByText('Cinco')).toBeTruthy();
    expect(screen.getByText('A resposta é cinco por causa da conta.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeTruthy();
  });

  it('"Próxima" busca outra questão', async () => {
    const second = { ...question, id: 6, statement: 'Quanto é três vezes três?' };
    const queue = [nextOf(question), nextOf(second, 2)];
    const user = userEvent.setup();
    await open({
      'GET /practice/next': () => ({ status: 200, data: queue.shift() }),
      'POST /answers': () => ({ status: 200, data: correctResult }),
    });

    await user.press(await screen.findByRole('radio', { name: 'Alternativa B: Quatro' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));
    await user.press(await screen.findByRole('button', { name: 'Próxima' }));

    expect(await screen.findByText('Quanto é três vezes três?')).toBeTruthy();
  });

  it('sem questões restantes mostra o fim da prática e permite voltar', async () => {
    const user = userEvent.setup();
    await open({
      'GET /practice/next': () => ({ status: 200, data: nextOf(null, 0) }),
      'GET /practice/subjects': subjects,
    });

    expect(await screen.findByText('Você praticou tudo por aqui!')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Escolha o que praticar.')).toBeTruthy();
  });

  it('409 mostra a mensagem e carrega a próxima questão', async () => {
    const second = { ...question, id: 6, statement: 'Quanto é três vezes três?' };
    const queue = [nextOf(question), nextOf(second, 2)];
    const user = userEvent.setup();
    await open({
      'GET /practice/next': () => ({ status: 200, data: queue.shift() }),
      'POST /answers': () => ({ status: 409, data: { message: 'Você já terminou esta questão.' } }),
    });

    await user.press(await screen.findByRole('radio', { name: 'Alternativa B: Quatro' }));
    await user.press(screen.getByRole('button', { name: 'Responder' }));

    expect(await screen.findByText('Quanto é três vezes três?')).toBeTruthy();
    expect(screen.getByText('Você já terminou esta questão.')).toBeTruthy();
  });

  it('mostra a imagem da questão com a URL resolvida', async () => {
    await open({
      'GET /practice/next': () => ({
        status: 200,
        data: nextOf({ ...question, image_url: '/uploads/questions/5-a.png' }),
      }),
    });

    expect(await screen.findByLabelText('Ampliar a imagem da questão.')).toBeTruthy();
    expect(screen.getByTestId('question-image').props.source).toEqual({
      uri: 'http://api.test/uploads/questions/5-a.png',
    });
  });
});

describe('Início', () => {
  it('saúda pelo primeiro nome e mostra sequência e moedas', async () => {
    await renderApp({ user: student, routes: { 'GET /me/stats': statsRoute } });

    expect(await screen.findByText('Oi, Ana!')).toBeTruthy();
    expect(await screen.findByLabelText('Sequência de 3 dias.')).toBeTruthy();
    expect(screen.getByLabelText('120 moedas.')).toBeTruthy();
    expect(screen.getByText('Seus planos aparecem aqui quando o professor enviar.')).toBeTruthy();
  });

  it('"Praticar agora" abre a aba Estudar', async () => {
    const user = userEvent.setup();
    await renderApp({
      user: student,
      routes: { 'GET /me/stats': statsRoute, 'GET /practice/subjects': subjects },
    });

    await user.press(await screen.findByRole('button', { name: 'Praticar agora' }));

    expect(await screen.findByText('Escolha o que praticar.')).toBeTruthy();
  });
});
