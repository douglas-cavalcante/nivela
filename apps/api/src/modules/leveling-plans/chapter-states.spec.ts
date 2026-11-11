import {
  percentOf,
  resolveChapterStates,
  resolvePlanState,
  type ChapterProgress,
} from 'src/modules/leveling-plans/chapter-states';

const chapter = (
  id: number,
  overrides: Partial<ChapterProgress> = {},
): ChapterProgress => ({
  id,
  title: `Capítulo ${id}`,
  position: id,
  total: 2,
  answered: 0,
  recorded: false,
  ...overrides,
});
const states = (chapters: ChapterProgress[]) =>
  resolveChapterStates(chapters).map((c) => c.state);

describe('resolveChapterStates (RN06 e Ruling 4)', () => {
  it('o primeiro está disponível e os seguintes trancados', () => {
    expect(states([chapter(1), chapter(2), chapter(3)])).toEqual([
      'available',
      'locked',
      'locked',
    ]);
  });

  it('concluir o N libera só o N+1', () => {
    expect(
      states([chapter(1, { recorded: true }), chapter(2), chapter(3)]),
    ).toEqual(['completed', 'available', 'locked']);
  });

  it('capítulo sem questões ativas conta como concluído e destrava o seguinte', () => {
    expect(states([chapter(1, { total: 0 }), chapter(2), chapter(3)])).toEqual([
      'completed',
      'available',
      'locked',
    ]);
  });

  it('capítulo vazio só conta como concluído se o anterior está concluído (Ruling 6)', () => {
    expect(states([chapter(1), chapter(2, { total: 0 }), chapter(3)])).toEqual([
      'available',
      'locked',
      'locked',
    ]);
    expect(
      states([
        chapter(1, { recorded: true }),
        chapter(2, { total: 0 }),
        chapter(3),
      ]),
    ).toEqual(['completed', 'completed', 'available']);
  });

  it('todas as questões ativas terminadas concluem o capítulo sem linha registrada', () => {
    expect(states([chapter(1, { answered: 2 }), chapter(2)])).toEqual([
      'completed',
      'available',
    ]);
  });

  it('plano sem capítulos não tem estados', () => {
    expect(resolveChapterStates([])).toEqual([]);
  });

  it('marca completed pelo estado', () => {
    const [a, b] = resolveChapterStates([
      chapter(1, { recorded: true }),
      chapter(2),
    ]);
    expect([a.completed, b.completed]).toEqual([true, false]);
  });
});

describe('resolvePlanState (Rulings 4, 9 e 11)', () => {
  const plan = (
    chapters: ChapterProgress[],
    overrides: { recorded?: boolean; hasFinishedAttempt?: boolean } = {},
  ) =>
    resolvePlanState({
      chapters,
      recorded: false,
      hasFinishedAttempt: false,
      ...overrides,
    });

  it('todos os capítulos vazios sem nenhuma resposta terminada não concluem o plano (Ruling 9)', () => {
    const state = plan([chapter(1, { total: 0 }), chapter(2, { total: 0 })]);
    expect(state.chapters.map((c) => c.state)).toEqual([
      'completed',
      'completed',
    ]);
    expect(state.completed).toBe(false);
    expect(state.pendingPlan).toBe(false);
  });

  it('uma resposta terminada e o resto vazio concluem o plano, pendente de gravação', () => {
    const state = plan(
      [chapter(1, { total: 1, answered: 1 }), chapter(2, { total: 0 })],
      { hasFinishedAttempt: true },
    );
    expect(state.completed).toBe(true);
    expect(state.pendingPlan).toBe(true);
    expect(state.pendingChapters.map((c) => c.id)).toEqual([1, 2]);
  });

  it('plano gravado continua concluído mesmo com capítulo novo', () => {
    const state = plan([chapter(1, { recorded: true }), chapter(2)], {
      recorded: true,
    });
    expect(state.completed).toBe(true);
    expect(state.pendingPlan).toBe(false);
  });

  it('plano sem capítulos nunca conclui', () => {
    expect(plan([], { hasFinishedAttempt: true }).completed).toBe(false);
  });

  it('capítulo vazio derivado também fica pendente de gravação (Ruling 11)', () => {
    const state = plan([chapter(1, { total: 0 }), chapter(2)]);
    expect(state.pendingChapters.map((c) => c.id)).toEqual([1]);
    expect(state.completed).toBe(false);
  });
});

describe('percentOf', () => {
  it('arredonda e não divide por zero', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(3, 3)).toBe(100);
    expect(percentOf(0, 0)).toBe(0);
  });
});
