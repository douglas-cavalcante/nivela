# Nivela — Plano 3: Estudo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O aluno estuda pelo app — responde questões com feedback, ganha moedas e mantém a sequência de dias — em prática livre e em planos de nivelamento por capítulos que o professor monta e atribui no painel web.

**Architecture:** Duas features novas na API: `answers` (tentativas, moedas, sequência — regras RN03–RN05, RN09, RN10) e `leveling-plans` (planos, capítulos, atribuição, progresso — RN06–RN08, RN15). Movimentação de moedas passa por um único `CoinLedger` em `src/shared/coins`. No app, a feature `study` concentra as telas de questão e feedback, reutilizadas pela prática livre e pelos planos. No painel, a feature `leveling-plans` monta, publica, atribui e acompanha planos.

**Tech Stack:** o mesmo dos Planos 1–2. Animações do app com `react-native-reanimated` (já instalado).

**Spec:** `docs/superpowers/specs/2026-11-08-nivela-design.md` (§5.1 linha "Planos", §5.2 Início/Plano/Questão/Feedback/Estudar, §6, §7 RN02–RN10, RN15). Pendências de entrada: `docs/superpowers/plans/2026-11-08-nivela-backlog.md` (seções "Plano 3 — antes de começar" e "Plano 3 — Estudo").

## Global Constraints

- Ambiente: Windows 11 + Git Bash, Node **22.14** (não atualizar), npm 10, Docker com `nivela_db` (porta 5433, bancos `nivela` e `nivela_test`). Portas 8000/8001 podem estar ocupadas por processos do usuário — use outras e não encerre o que não iniciou.
- Ler antes de codar: `CLAUDE.md`, `docs/architecture.md`, `docs/estruturaDePastas.md`, `docs/workflow.md`.
- **Autorização deny-by-default** (`@Roles`/`@AnyAuthenticated`/`@Public` em toda rota; o meta-teste cobra). Aluno = `Role.Student`; staff = `Role.Admin` + `Role.Teacher`. Recurso fora do escopo do professor ou do aluno → **404** com a mensagem do recurso.
- **JSON snake_case**; listas paginadas com `PaginationQueryDto`/`paginate`; listas curtas com `ApiList<T>`; parâmetro vazio = ausente (`@EmptyAsUndefined()`); busca com `containsInsensitive`; ids com `ParseIdPipe`.
- **Tipos de resposta só em `packages/api-contract`** (a API usa `import type`; presenters com `satisfies`).
- **Moedas:** só pelo `CoinLedger` (linha em `coin_transactions` + `coins_balance` na mesma transação; saldo nunca negativo — CHECK no banco).
- **Datas de estudo:** "hoje" calculado explicitamente em `America/Fortaleza` (não depender de `TZ` do processo); relógio injetável (`src/shared/clock`).
- **RN05:** o aluno nunca recebe `correct_letter` nem `explanation` antes de terminar a questão no contexto. Presenter próprio do aluno; e2e afirmando a ausência.
- Mensagens em pt-BR, frases completas com ponto (inclusive títulos de estado vazio). Cores só por tokens.
- Prisma: `migrate dev --create-only` + SQL à mão quando preciso (índices parciais, CHECK, FK composta) + `npm run db:migrate -w apps/api`; **nunca** `prisma migrate reset`; conferir drift com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (deve sair vazio).
- Testes: API unit + e2e (`resetDatabase`, factories, `tokenFor`); web Vitest + MSW; mobile jest-expo com o fake de `src/test/render.tsx`. Saída limpa. `npx expo export --platform android` continua passando.
- Commits: Conventional Commits em pt-BR com escopo, pequenos, **sem `Co-Authored-By`**; repositório assina via SSH — não mexer em `git config`. O implementador não faz merge nem push.

## Review Focus

1. **Vazamento da resposta (RN05):** qualquer rota que o aluno chama (`/practice/next`, `/me/plans/:id/chapters/:id/next`, `POST /answers` com acerto na 1ª ou erro na 1ª) nunca traz `correct_letter`/`explanation` antes de a questão terminar no contexto. Testes na Task 5 e Task 9.
2. **Moedas em dobro (RN04):** responder certo a mesma questão na prática e depois num capítulo (ou duas requisições simultâneas) credita moedas **uma vez só**; o saldo bate com a soma do extrato. Testes na Task 4 e Task 5.
3. **Terceira tentativa / capítulo trancado:** `POST /answers` depois de terminar a questão no contexto → 409 "Você já terminou esta questão."; responder questão de capítulo ainda trancado → 409 "Conclua o capítulo anterior para liberar este."; questão que não pertence ao capítulo → 404. Testes na Task 5 e Task 9.
4. **Virada do dia em Fortaleza (RN09):** respostas às 23h50 e 00h10 (horário de Fortaleza) contam dias consecutivos; pular um dia zera; o bônus de 7 dias entra uma vez por marco. Testes na Task 4.
5. **Aluno vendo plano de outra turma / professor atribuindo a turma de outro professor:** 404 para o aluno; 404/422 para o professor (escopo RN15). Testes nas Tasks 8 e 9.

---

### Task 1: Pré-requisitos da API (FK composta, política de edição)

**Branch:** `feature/plan3-foundation` (Tasks 1, 2 e 3)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` + migration `question_category_subject_fk` (SQL à mão: `ALTER TABLE categories ADD CONSTRAINT categories_id_subject_id_key UNIQUE (id, subject_id);` e `ALTER TABLE questions ADD CONSTRAINT questions_category_subject_fkey FOREIGN KEY (category_id, subject_id) REFERENCES categories (id, subject_id) ON DELETE RESTRICT;`)
- Modify: `apps/api/src/modules/questions/questions.service.ts` (`translate()` reconhece também `questions_category_subject_fkey` → 422 `category_id ["A categoria não pertence à disciplina."]`)
- Test: `apps/api/test/questions.e2e-spec.ts` (caso de banco), unit do service

**Interfaces:**
- Produces: banco garante categoria × disciplina; a checagem do service continua (mensagem igual). A política "questão com tentativas não troca `correct_letter`" é implementada na Task 5 (depende da tabela de tentativas).

- [ ] **Step 1:** `git checkout develop && git pull --ff-only && git checkout -b feature/plan3-foundation`
- [ ] **Step 2: Testes que falham** — e2e: inserir direto no banco (Prisma) uma questão com categoria de outra disciplina → rejeitado pelo banco; via API continua 422 com a mesma mensagem; drift vazio.
- [ ] **Step 3:** FAIL → migration + `translate()` → PASS (unit, e2e, lint, typecheck).
- [ ] **Step 4: Commit** `feat(api): garante no banco que a categoria pertence à disciplina da questão`

---

### Task 2: Autocomplete com busca no servidor (web)

**Branch:** `feature/plan3-foundation` (continuação)

**Files:**
- Create: `apps/web/src/components/AsyncAutocomplete/index.tsx` (+ teste)
- Modify: `apps/web/src/features/classrooms/components/ClassroomFormDialog.tsx` (professor), `apps/web/src/features/students/pages/StudentList/index.tsx` (filtro de turma)

**Interfaces:**
- Produces:
  ```ts
  interface AsyncAutocompleteProps<T> {
    label: string;
    value: T | null;
    onChange: (value: T | null) => void;
    load: (search: string, signal: AbortSignal) => Promise<T[]>;   // até 20 itens
    getOptionLabel: (option: T) => string;
    getOptionKey: (option: T) => number;
    placeholder?: string; error?: string; disabled?: boolean; noOptionsText?: string; // padrão "Nada encontrado."
  }
  ```
  Busca com debounce de 300 ms, cancela a anterior (`AbortController`), descarta resposta atrasada, mostra "Carregando…" e erro ("Não foi possível carregar as opções."). Valor inicial vindo da URL é resolvido por um `load` com busca vazia + id (ou o chamador passa o objeto).
- Os dois selects deixam de usar `per_page: 100`: chamam a listagem com `search` e `per_page=20`.

- [ ] **Step 1: Testes que falham** — digitar dispara uma busca após 300 ms com o texto; resposta atrasada da busca anterior é ignorada; erro mostra a mensagem; selecionar chama `onChange` com o objeto; ClassroomFormDialog (admin) busca professores ativos por texto; StudentList filtra por turma escolhida no autocomplete (URL `classroom_id`).
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, vitest, build).
- [ ] **Step 3: Commits** `feat(web): adiciona autocomplete com busca no servidor` · `refactor(web): usa o autocomplete para professor e turma`

---

### Task 3: Base do app para as telas de estudo (mobile)

**Branch:** `feature/plan3-foundation` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/hooks/useRemote.ts` (+ teste), `apps/mobile/src/test/expectParams.ts` (helper para afirmar `config.params` nos handlers do fake)
- Modify: `apps/mobile/src/components/OfflineScreen.tsx` + `app/_layout.tsx` / `src/lib/auth/AuthContext.tsx` (texto por tipo de erro e botão "Sair"), `apps/mobile/src/features/classrooms/components/MyClassroomsCard.tsx` (passa a usar `useRemote`)

**Interfaces:**
- Produces:
  - `useRemote<T>(key: string, load: (signal: AbortSignal) => Promise<T>): { data: T | null; loading: boolean; error: string | null; errorStatus: number | null; reload(): void }` — mesmo contrato do `useRemoteList` da web (cancela ao trocar a chave ou desmontar, descarta resposta atrasada, `reload` não termina cedo se superado).
  - Tela de falha do boot: sem resposta/timeout → "Sem conexão com o servidor."; 5xx → "O servidor está com problemas."; outros (403/404/429) → "Não foi possível abrir sua conta agora."; sempre "Tentar de novo" e **"Sair"** (limpa o token e volta às boas-vindas).

- [ ] **Step 1: Testes que falham** — `useRemote`: resposta atrasada ignorada, abort no desmontar, reload, erro; tela de falha mostra o texto certo para rede/503/429 e "Sair" leva às boas-vindas sem token; `MyClassroomsCard` continua passando nos testes atuais.
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, jest, `expo export`).
- [ ] **Step 3: Commits** `feat(mobile): adiciona hook de dados remotos com cancelamento` · `fix(mobile): tela de falha explica o erro e permite sair`

---

### Task 4: Tentativas, moedas e sequência — base da API

**Branch:** `feature/answers` (Tasks 4, 5 e 6)

**Files:**
- Modify: `prisma/schema.prisma` (`QuestionAttempt`, `CoinTransaction`, enum `CoinReason`) + migration `answers` com SQL à mão:
  - `question_attempts`: `id`, `student_id` FK users Cascade, `question_id` FK Restrict, `plan_chapter_id` **int null** (a FK para `plan_chapters` entra na Task 7), `selected_option_id` FK `question_options` Restrict, `attempt_number` smallint CHECK (1,2), `is_correct` bool, `coins_awarded` int default 0, `created_at` timestamptz; índices únicos parciais `question_attempts_practice_key (student_id, question_id, attempt_number) WHERE plan_chapter_id IS NULL` e `question_attempts_chapter_key (student_id, question_id, plan_chapter_id, attempt_number) WHERE plan_chapter_id IS NOT NULL`; índice `(student_id, question_id)`.
  - `coin_transactions`: `id`, `student_id` FK Cascade, `amount` int (≠ 0), `reason` enum (`correct_answer`, `plan_completed`, `streak_bonus`, `redemption`, `refund`), `source_type` varchar(30), `source_id` int, `created_at`; índice `(student_id, created_at)`; únicos parciais `coin_once_per_question (student_id, source_id) WHERE reason = 'correct_answer'`, `coin_once_per_plan (student_id, source_id) WHERE reason = 'plan_completed'`, `coin_once_per_streak_day (student_id, source_id) WHERE reason = 'streak_bonus'`.
  - `student_profiles`: `CHECK (coins_balance >= 0)`.
- Create: `src/shared/coins/coin-ledger.ts` (+ spec), `src/shared/study/study-day.ts` (+ spec), `src/shared/study/streak.service.ts` (+ spec), módulo `src/shared/study/study.module.ts` (exporta os dois services)
- Test: `test/coin-ledger.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `CoinLedger.credit(tx, { studentId, amount, reason, sourceType, sourceId }): Promise<{ applied: boolean; balance: number }>` — insere a transação e incrementa `coins_balance` na mesma `tx`; se o índice único "uma vez" disparar (P2002 — usar `isUniqueViolation` com o nome do índice) devolve `applied: false` sem alterar o saldo. `debit(...)` existe mas só é usado no Plano 4 (saldo insuficiente → `BusinessRuleException("Saldo insuficiente.")`).
  - `studyDay(date: Date): string` → `'YYYY-MM-DD'` em `America/Fortaleza` (usar `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' })`); `dayNumber(day: string): number` (dias desde 1970-01-01).
  - `StreakService.register(tx, studentId, now: Date): Promise<{ current: number; best: number; bonus_awarded: number }>` — RN09: mesmo dia → nada; dia seguinte → `current + 1`; senão → 1; `best = max`; quando `current` vira múltiplo de 7 → `CoinLedger.credit(20, 'streak_bonus', source_type 'study_day', source_id = dayNumber)`.
  - Constantes em `src/shared/coins/coin-rules.ts`: `COINS_FIRST_TRY = 10`, `COINS_SECOND_TRY = 5`, `STREAK_BONUS = 20`, `STREAK_BONUS_EVERY = 7`.

- [ ] **Step 1: Testes que falham** — unit `studyDay`: `2026-11-10T02:50:00Z` → `'2026-11-09'` (23h50 em Fortaleza) e `03:10Z` → `'2026-11-10'`; `StreakService` (relógio injetado): dias 1→2→3 sobem, pular um dia volta a 1, 7º dia credita 20 uma vez e repetir o mesmo dia não credita de novo, `best` preservado; `CoinLedger`: credita e soma no saldo; "uma vez por questão" repetido → `applied:false` e saldo igual; e2e: duas `credit` simultâneas da mesma questão → uma linha e saldo +10; CHECK impede saldo negativo no banco.
- [ ] **Step 2:** FAIL → schema/migration/services → PASS; drift vazio.
- [ ] **Step 3: Commits** `feat(api): adiciona tentativas e extrato de moedas ao schema` · `feat(api): implementa o extrato de moedas com crédito único` · `feat(api): implementa a sequência de estudo no fuso de Fortaleza`

---

### Task 5: Prática livre e respostas na API

**Branch:** `feature/answers` (continuação)

**Files:**
- Create: `src/modules/answers/{answers.module.ts, answers.controller.ts, answers.service.ts, answers.service.spec.ts, practice.controller.ts, practice.service.ts, me-stats.controller.ts, dto/answer.dto.ts, dto/practice-next.query.ts, presenters/student-question.presenter.ts, presenters/answer-result.presenter.ts}`, `packages/api-contract/src/study.ts`
- Modify: `src/modules/questions/questions.service.ts` (política de edição com tentativas), `src/app.module.ts`
- Test: `test/practice.e2e-spec.ts`, `test/answers.e2e-spec.ts`, `test/question-edit-policy.e2e-spec.ts`

**Interfaces:**
- Contrato:
  ```ts
  export interface ApiStudentQuestion { id: number; statement: string; image_url: string | null; difficulty: Difficulty;
    subject: { id: number; name: string; color: SubjectColorKey }; category: { id: number; name: string };
    options: Array<{ letter: OptionLetter; text: string }>;
    attempts_left: 1 | 2 }                                   // sem correct_letter, sem explanation (RN05)
  export interface ApiPracticeSubject { id: number; name: string; color: SubjectColorKey; icon: SubjectIconKey;
    available_questions: number; categories: Array<{ id: number; name: string; available_questions: number }> }
  export interface ApiPracticeNext { question: ApiStudentQuestion | null; remaining: number }
  export interface ApiAnswerPayload { question_id: number; selected_letter: OptionLetter; plan_chapter_id?: number }
  export interface ApiAnswerResult { is_correct: boolean; attempt_number: 1 | 2; finished: boolean;
    coins_awarded: number; coins_balance: number;
    correct_letter: OptionLetter | null; explanation: string | null;      // só quando finished
    streak: { current: number; best: number; bonus_awarded: number };
    chapter?: { completed: boolean; next_chapter_id: number | null };     // preenchido na Task 8
    plan?: { completed: boolean; bonus_awarded: number } }                 // preenchido na Task 8
  export interface ApiStudentStats { coins_balance: number; current_streak: number; best_streak: number }
  ```
- Rotas do aluno (`@Roles(Role.Student)`):
  | Rota | Sucesso | Erros |
  |---|---|---|
  | `GET /practice/subjects` | `200 ApiList<ApiPracticeSubject>` (só disciplinas/categorias com questões **ativas**; contagem = ativas ainda não terminadas pelo aluno na prática) | — |
  | `GET /practice/next?subject_id&category_id` | `200 ApiPracticeNext` — próxima questão **ativa** da disciplina/categoria que o aluno ainda não terminou na prática (ordem: menor `id`); `question: null` quando acabou | 422 `subject_id` obrigatório ("Escolha uma disciplina."); 404 disciplina inexistente |
  | `POST /answers` (`ApiAnswerPayload`) | `200 ApiAnswerResult` | 404 "Questão não encontrada." (inexistente ou inativa); 422 `selected_letter`; 409 "Você já terminou esta questão." (acertou ou esgotou as 2 tentativas no contexto); `plan_chapter_id` informado nesta task → 422 "Capítulo não encontrado." (a Task 8 implementa) |
  | `GET /me/stats` | `200 ApiStudentStats` | — |
- `POST /answers` numa transação: lê as tentativas do aluno nessa questão no contexto (`plan_chapter_id` nulo = prática); calcula `attempt_number`; resolve a alternativa por `(question_id, letter)`; grava a tentativa (o índice único parcial decide corridas → 409 "Você já terminou esta questão."); se acertou → `CoinLedger.credit(attempt 1 ? 10 : 5, 'correct_answer', source_type 'question', source_id = question_id)` (única por questão em qualquer contexto, RN04) e `coins_awarded` = valor aplicado (0 se já ganhou antes); `StreakService.register`; `finished = is_correct || attempt_number === 2`; `correct_letter`/`explanation` só quando `finished`.
- **Política de edição (RN02 + backlog):** `PUT /questions/:id` que muda `correct_letter` numa questão com tentativas → 409 "Esta questão já foi respondida; não é possível trocar a alternativa correta." (texto, enunciado e explicação continuam editáveis).

- [ ] **Step 1: Testes que falham** — e2e: aluno lista disciplinas de prática (questão inativa não conta); `next` não traz `correct_letter`/`explanation` (Review Focus 1); acerto na 1ª → +10, `finished`, explicação presente; erro na 1ª → `finished:false`, **sem** `correct_letter`/`explanation`, `attempts_left` do `next` = 1; erro na 2ª → `finished`, correta + explicação; 3ª chamada → 409; acertar de novo a mesma questão em outro contexto (simular pela prática após terminar e criar contexto de capítulo só na Task 8 — aqui: duas requisições simultâneas na prática) → moedas uma vez (Review Focus 2); saldo = soma do extrato; staff → 403; questão inativa → 404; sequência atualizada (`/me/stats`); PUT trocando `correct_letter` com tentativas → 409, trocando só o texto → 200.
- [ ] **Step 2:** FAIL → implementar → PASS (unit, e2e, lint, typecheck, build).
- [ ] **Step 3: Commits** `feat(contract): adiciona tipos de estudo` · `feat(api): implementa respostas com tentativas, moedas e sequência` · `feat(api): implementa a prática livre do aluno` · `feat(api): bloqueia trocar a alternativa correta de questão já respondida`

---

### Task 6: Prática livre no app (Estudar, Questão, Feedback) e Início

**Branch:** `feature/answers` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/features/study/{api/study.api.ts, api/study.action.ts, components/QuestionView.tsx, components/OptionButton.tsx, components/FeedbackView.tsx, components/CoinBurst.tsx, components/StatsBar.tsx, screens/StudyHome.tsx, screens/PracticeQuestion.tsx, index.ts, __tests__/…}`
- Modify/Create rotas: `app/(tabs)/study.tsx` (Estudar), `app/(tabs)/index.tsx` (Início), `app/practice/[subjectId].tsx` (questão da prática; `?category_id=` opcional)
- Modify: web `QuestionForm` mostra o 409 da política de edição no campo `correct_letter` (aviso), com teste

**Interfaces:**
- Consumes: Task 3 (`useRemote`), Task 5 (rotas), `resolveAssetUrl(EXPO_PUBLIC_API_URL, image_url)` do contrato para a imagem.
- Produces (reutilizados na Task 10):
  - `QuestionView({ question, onAnswer(letter): Promise<void>, disabled })` — enunciado (Nunito, tamanho ajustável), imagem (toque abre em tela cheia), alternativas A–E como `OptionButton` grandes (≥ 56 px, letra em círculo, seleção com marca-texto), botão "Responder" só com uma escolhida.
  - `FeedbackView({ result, onNext, onRetry })` — acerto: título "Isso aí!" com sublinhado de marca-texto animado + `CoinBurst` "+10 🪙" (moedas voando até o contador) + explicação; erro na 1ª: "Quase! Tente de novo." + botão "Tentar de novo" (sem revelar a resposta); erro na 2ª: "Resposta: C" com a alternativa destacada + explicação + "Próxima".
  - `StatsBar` (🔥 sequência, 🪙 moedas) lida de `GET /me/stats`, atualizada pelo `ApiAnswerResult`.
- Estudar: cards de disciplina (cor/ícone dos tokens, "N questões para praticar") → escolher categoria opcional → abrir a prática; fim da prática: mascote "Você praticou tudo por aqui!" + voltar.
- Início: saudação ("Oi, <primeiro nome>!"), `StatsBar`, atalho "Praticar agora" e, até a Task 10, `EmptyState` "Seus planos aparecem aqui quando o professor enviar." (com ponto).
- Acessibilidade: `accessibilityRole="radio"` nas alternativas com estado, anúncio do resultado (`accessibilityLiveRegion`/`AccessibilityInfo.announceForAccessibility`), respeitar "reduzir movimento" (sem animação de moedas).

- [ ] **Step 1: Testes que falham** — Estudar lista disciplinas do fake; abrir prática busca `next` com `subject_id`/`category_id` (afirmar `params`); responder envia `{ question_id, selected_letter }`; acerto mostra "+10" e explicação; erro na 1ª mostra "Tentar de novo" sem a letra certa; erro na 2ª mostra a correta; `question: null` mostra o fim; 409 mostra a mensagem e carrega a próxima; Início mostra sequência e moedas; web: 409 de `correct_letter` aparece no formulário.
- [ ] **Step 2:** FAIL → implementar → PASS (mobile lint/typecheck/jest/`expo export`; web lint/typecheck/vitest).
- [ ] **Step 3: Commits** `feat(mobile): adiciona telas de questão e feedback` · `feat(mobile): adiciona prática livre na aba Estudar` · `feat(mobile): mostra sequência e moedas no Início` · `feat(web): avisa quando a alternativa correta não pode mudar`

---

### Task 7: Planos de nivelamento na API (professor)

**Branch:** `feature/leveling-plans` (Tasks 7, 8, 9 e 10)

**Files:**
- Modify: `prisma/schema.prisma` (`LevelingPlan`, `PlanChapter`, `ChapterQuestion`, `PlanAssignment`, `ChapterCompletion`, `PlanCompletion`, enum `PlanStatus`) + migration `leveling_plans` com SQL à mão: FK `question_attempts.plan_chapter_id → plan_chapters` (Restrict); `plan_assignments` CHECK "exatamente um de `classroom_id`/`student_id`"; únicos parciais `(leveling_plan_id, classroom_id) WHERE classroom_id IS NOT NULL` e `(leveling_plan_id, student_id) WHERE student_id IS NOT NULL`; único `(leveling_plan_id, position)` em capítulos e `(plan_chapter_id, position)` em `chapter_question` (DEFERRABLE INITIALLY DEFERRED para reordenar numa transação).
- Create: `src/modules/leveling-plans/{leveling-plans.module.ts, plans.controller.ts, plans.service.ts, plans.service.spec.ts, chapters.service.ts, assignments.service.ts, plan-progress.service.ts, dto/…, presenters/…}`, `src/shared/scopes/plan-scope.ts`, `packages/api-contract/src/plans.ts`
- Test: `test/plans.e2e-spec.ts`, `test/plan-assignments.e2e-spec.ts`

**Interfaces:**
- Tabelas conforme spec §6 (`leveling_plans`: `teacher_id`, `subject_id`, `title` 3–120, `description` ≤ 1000, `completion_bonus` 0–500 default 50, `status` `draft|published`, `published_at`).
- Contrato:
  ```ts
  export type PlanStatus = 'draft' | 'published';
  export interface ApiPlanSummary { id: number; title: string; status: PlanStatus; subject: { id: number; name: string; color: SubjectColorKey };
    chapters_count: number; questions_count: number; assignments_count: number; teacher: { id: number; name: string }; updated_at: string }
  export interface ApiPlanChapter { id: number; title: string; position: number;
    questions: Array<{ id: number; statement_excerpt: string; difficulty: Difficulty; active: boolean }> }
  export interface ApiPlan extends ApiPlanSummary { description: string | null; completion_bonus: number; chapters: ApiPlanChapter[];
    has_progress: boolean; can_edit: boolean }
  export interface ApiPlanAssignment { id: number; target: { type: 'classroom' | 'student'; id: number; name: string }; due_date: string | null; created_at: string }
  export interface ApiPlanProgressRow { student: { id: number; name: string }; completed_chapters: number; total_chapters: number;
    answered: number; correct: number; completed_at: string | null }
  export interface ApiStudentPlanProgress { plan: { id: number; title: string; subject: { id: number; name: string; color: SubjectColorKey } };
    completed_chapters: number; total_chapters: number; completed_at: string | null; due_date: string | null }
  ```
- Os únicos `DEFERRABLE` de posição existem **só no SQL** da migration (o Prisma não expressa `DEFERRABLE`): não declarar `@@unique` de posição no `schema.prisma` e conferir que o drift continua vazio.
- Rotas staff (`@Roles(Admin, Teacher)`; professor só os próprios planos — `planScope(user)`; fora → 404 "Plano não encontrado."):
  | Rota | Regras |
  |---|---|
  | `GET /plans?page&per_page&search&status&subject_id` | `Paginated<ApiPlanSummary>` |
  | `POST /plans` (`title`, `description?`, `subject_id`, `completion_bonus`) | `201 ApiPlan` (`draft`) |
  | `GET /plans/:id`, `PUT /plans/:id` | edição de dados sempre permitida |
  | `POST /plans/:id/chapters` (`title`) · `PUT /plans/:id/chapters/:chapterId` (`title`) · `DELETE …/chapters/:chapterId` · `PUT /plans/:id/chapters/order` (`chapter_ids[]`) | RN08: remover capítulo de plano com progresso → 409 "O plano já tem progresso de alunos; não é possível remover capítulos ou questões." |
  | `PUT /plans/:id/chapters/:chapterId/questions` (`question_ids[]`, ordem = posição) | substitui a lista; só questões **ativas** da **mesma disciplina** do plano (422 `question_ids` "Escolha questões ativas da disciplina do plano."); remover questão de plano com progresso → 409 (mesma mensagem); adicionar é permitido |
  | `POST /plans/:id/publish` | 409 "Adicione ao menos um capítulo com questões antes de publicar." se algum capítulo vazio ou nenhum capítulo |
  | `GET /plans/:id/assignments` · `POST /plans/:id/assignments` (`classroom_id` **ou** `student_id`, `due_date?` ISO date ≥ hoje) · `DELETE …/assignments/:assignmentId` | só plano publicado (409 "Publique o plano antes de atribuir."); turma/aluno fora do escopo do professor → 422 no campo ("Turma não encontrada." / "Aluno não encontrado."); duplicado → 422 "Este plano já foi atribuído a esta turma." / "…a este aluno." |
  | `GET /plans/:id/progress` | `ApiList<ApiPlanProgressRow>` — alunos atribuídos (diretamente ou pela turma), ordenados por nome |
  | `GET /students/:id/plans` | `ApiList<ApiStudentPlanProgress>` — planos visíveis ao professor (`planScope`) atribuídos ao aluno (aluno fora do `studentScope` → 404 "Aluno não encontrado.") |
  | `DELETE /plans/:id` | só `draft` sem atribuições; senão 409 "Só é possível excluir planos em rascunho." |
- `has_progress` = existe tentativa com `plan_chapter_id` de algum capítulo do plano.

- [ ] **Step 1: Testes que falham** — CRUD de plano/capítulos/questões com ordem; questão de outra disciplina ou inativa → 422; publicar vazio → 409; atribuir antes de publicar → 409; atribuir turma de outro professor → 422 (Review Focus 5); duplicado → 422; professor B não vê plano de A (404); admin vê tudo; remover capítulo com progresso → 409 (cria tentativa direto no banco); reordenar capítulos numa transação sem violar o único; progresso calcula concluídos; excluir publicado → 409; aluno → 403; drift vazio.
- [ ] **Step 2:** FAIL → implementar → PASS (unit, e2e, lint, typecheck, build).
- [ ] **Step 3: Commits** `feat(api): adiciona planos, capítulos e atribuições ao schema` · `feat(api): implementa a montagem e publicação de planos` · `feat(api): implementa a atribuição de planos a turmas e alunos` · `feat(api): implementa o progresso dos alunos no plano` · `feat(contract): adiciona tipos de plano`

---

### Task 8: Planos do aluno na API (capítulos, desbloqueio, bônus)

**Branch:** `feature/leveling-plans` (continuação)

**Files:**
- Create: `src/modules/leveling-plans/{student-plans.controller.ts, student-plans.service.ts, student-plans.service.spec.ts, presenters/my-plan.presenter.ts}`
- Modify: `src/modules/answers/answers.service.ts` (contexto de capítulo: valida acesso e desbloqueio, conclui capítulo/plano, preenche `chapter`/`plan` no resultado), `packages/api-contract/src/plans.ts`
- Test: `test/student-plans.e2e-spec.ts`, `test/answers-chapters.e2e-spec.ts`

**Interfaces:**
- Contrato:
  ```ts
  export type ChapterState = 'locked' | 'available' | 'completed';
  export interface ApiMyPlanSummary { id: number; title: string; subject: { id: number; name: string; color: SubjectColorKey; icon: SubjectIconKey };
    progress: { completed_chapters: number; total_chapters: number; percent: number }; due_date: string | null; completed: boolean; completion_bonus: number }
  export interface ApiMyPlan extends ApiMyPlanSummary { description: string | null;
    chapters: Array<{ id: number; title: string; position: number; state: ChapterState; answered: number; total: number }> }
  export interface ApiChapterNext { question: ApiStudentQuestion | null; remaining: number }
  ```
- Rotas do aluno (`@Roles(Student)`; só planos **publicados** atribuídos a ele ou a uma turma em que está matriculado; senão 404 "Plano não encontrado."):
  | Rota | Regras |
  |---|---|
  | `GET /me/plans` | `ApiList<ApiMyPlanSummary>` (não concluídos primeiro, depois por prazo e título); `due_date` = o menor entre as atribuições que o alcançam |
  | `GET /me/plans/:id` | `ApiMyPlan` — capítulo 1 `available` (ou `completed`), N+1 só `available` após N `completed` (RN06) |
  | `GET /me/plans/:id/chapters/:chapterId/next` | `ApiChapterNext` — próxima questão **ativa** do capítulo não terminada **nesse capítulo**; capítulo trancado → 409 "Conclua o capítulo anterior para liberar este."; capítulo de outro plano → 404 "Capítulo não encontrado." |
- `POST /answers` com `plan_chapter_id`: o capítulo precisa ser de um plano visível ao aluno (senão 404 "Capítulo não encontrado.") e estar `available` (senão 409 acima); a questão precisa pertencer ao capítulo (senão 404 "Questão não encontrada."). Depois de gravar: se todas as questões **ativas** do capítulo estão terminadas no capítulo → `chapter_completions` (PK evita duplicar); se foi o último capítulo → `plan_completions` + `CoinLedger.credit(completion_bonus, 'plan_completed', source_type 'plan', source_id = plan_id)` uma única vez (RN07); `ApiAnswerResult.chapter`/`.plan` preenchidos. Questões desativadas depois de entrar no capítulo não bloqueiam a conclusão.

- [ ] **Step 1: Testes que falham** — aluno da turma atribuída vê o plano; aluno de outra turma → 404 (Review Focus 5); rascunho não aparece; capítulo 2 trancado até concluir o 1 (409 em `next` e em `POST /answers`); questão de fora do capítulo → 404; concluir capítulo libera o próximo; concluir o último → bônus uma vez (repetir não credita); acertar no capítulo questão já acertada na prática → 0 moedas (Review Focus 2) mas conta para o capítulo; `next` sem `correct_letter`/`explanation` (Review Focus 1); questão desativada não trava o capítulo; `/me/plans` ordena e calcula `percent`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Commits** `feat(api): lista os planos do aluno com capítulos e desbloqueio` · `feat(api): conclui capítulos e planos com bônus único`

---

### Task 9: Planos no painel web

**Branch:** `feature/leveling-plans` (continuação)

**Files:**
- Create: `apps/web/src/features/leveling-plans/{api/…, components/PlanFormDialog.tsx, components/ChapterCard.tsx, components/QuestionPicker.tsx, components/AssignDialog.tsx, components/ProgressTable.tsx, pages/PlanList/index.tsx, pages/PlanEditor/index.tsx, schemas/…, index.ts}`
- Modify: rotas (`/planos`, `/planos/:id`), `implemented`; `apps/web/src/features/students/pages/StudentDetail` (a seção reservada "Planos" passa a listar `GET /students/:id/plans`: título com link para `/planos/:id`, `SubjectBadge`, barra "x de y capítulos", prazo e "Concluído em …")

**Interfaces:**
- Lista: `DataTable` com busca, status (Rascunho/Publicado) e disciplina na URL; colunas título, `SubjectBadge`, capítulos, questões, atribuições, status; "Novo plano".
- Editor (`/planos/:id`): cabeçalho com dados do plano (editar) + status + "Publicar" (ConfirmDialog "Depois de publicado, o plano pode ser atribuído às turmas."); capítulos como fichas de caderno numeradas (subir/descer, renomear, excluir com confirmação; 409 com progresso vira aviso); em cada capítulo, lista ordenável de questões (subir/descer/remover) e "Adicionar questões" (`QuestionPicker`: `AsyncAutocomplete`/lista com busca e filtro de categoria, só questões ativas da disciplina do plano, multi-seleção); aba/seção "Atribuições" (turma ou aluno via `AsyncAutocomplete`, prazo opcional, remover); aba "Progresso" (`ProgressTable`: aluno, capítulos concluídos com barra, acertos/respondidas, concluído em).
- Plano sem `can_edit` (de outro professor, visto pelo admin) continua editável pelo admin; professor nunca vê plano alheio (404 → `ResourceState`).

- [ ] **Step 1: Testes que falham** — lista com filtros na URL; criar plano navega para o editor; adicionar capítulo e questões envia a lista na ordem; reordenar envia `chapter_ids`; publicar com capítulo vazio mostra o 409; atribuir turma envia `classroom_id` e `due_date`; 422 de duplicado aparece no campo; remover capítulo com progresso mostra o aviso do 409; progresso renderiza as linhas; ficha do aluno mostra os planos.
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, vitest, build).
- [ ] **Step 3: Commits** `feat(web): adiciona lista de planos` · `feat(web): adiciona editor de planos com capítulos e questões` · `feat(web): adiciona atribuição e progresso dos planos` · `feat(web): mostra os planos na ficha do aluno`

---

### Task 10: Planos no app

**Branch:** `feature/leveling-plans` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/features/plans/{api/…, components/PlanCard.tsx, components/ChapterPage.tsx, components/PlanCompleted.tsx, screens/MyPlans.tsx, screens/PlanDetail.tsx, screens/ChapterQuestion.tsx, index.ts, __tests__/…}`
- Modify/Create rotas: `app/(tabs)/index.tsx` (Início com "Meus planos"), `app/plans/[id].tsx`, `app/plans/[id]/chapters/[chapterId].tsx`

**Interfaces:**
- Consumes: `QuestionView`, `FeedbackView`, `StatsBar`, `CoinBurst` (Task 6 — exportados pelo `index.ts` de `study`), rotas da Task 8.
- Início: `StatsBar` + "Meus planos" com `PlanCard` (título com marca-texto da cor da disciplina, barra de progresso de caneta, "3 de 5 capítulos", prazo "Até 20/11." quando houver) + "Praticar agora"; vazio: `EmptyState` "Seus planos aparecem aqui quando o professor enviar.".
- Plano: capítulos como "páginas do caderno" (`ChapterPage`: número grande em Caveat, título, "x de y questões", cadeado nos trancados com texto "Conclua o capítulo anterior."), toque abre a questão do capítulo; animação de página virando ao abrir (respeitar "reduzir movimento").
- Questão do capítulo: mesmo fluxo da prática com `plan_chapter_id`; ao concluir capítulo → mensagem "Capítulo concluído!" e botão "Próximo capítulo"; ao concluir o plano → `PlanCompleted` (mascote comemorando, "+<bônus> 🪙", "Voltar ao início").

- [ ] **Step 1: Testes que falham** — Início lista planos do fake com progresso e prazo; vazio mostra a mensagem; plano mostra capítulos com estados; trancado não abre (mostra o texto); questão do capítulo envia `plan_chapter_id`; resultado com `chapter.completed` mostra "Capítulo concluído!"; com `plan.completed` mostra o bônus; 409 de capítulo trancado mostra a mensagem.
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, jest, `expo export`).
- [ ] **Step 3: Commits** `feat(mobile): mostra os planos do aluno no Início` · `feat(mobile): adiciona a tela do plano com capítulos` · `feat(mobile): permite estudar os capítulos do plano`

---

### Task 11: Fechamento do plano

**Branch:** `feature/plan3-docs`

**Files:**
- Modify: `docs/estruturaDePastas.md` (features `answers`, `leveling-plans`, `study`, `plans`), `docs/architecture.md` (CoinLedger, dia de estudo em Fortaleza, índices parciais de "uma vez", política de edição), `docs/superpowers/specs/2026-11-08-nivela-design.md` (se algum contrato divergiu — p. ex. `selected_letter`), `docs/superpowers/plans/2026-11-08-nivela-backlog.md` (marcar o que o Plano 3 resolveu e acrescentar as sobras), `README.md` (fluxo do aluno para testar)

- [ ] **Step 1:** Atualizar docs e backlog.
- [ ] **Step 2: Verificação geral** — `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build` e `npx expo export --platform android` → PASS. Manual (API e web em portas livres): criar disciplina, categoria, 3 questões, turma, aluno; plano com 2 capítulos publicado e atribuído à turma; com o aluno via `curl` (`channel: 'mobile'`): responder errado/errado/certo, concluir capítulo 1, ver o 2 liberado, concluir o plano e conferir bônus e extrato; limpar os dados de demonstração do banco `nivela` (deixar só o admin) e os uploads; encerrar os servidores.
- [ ] **Step 3: Commit** `docs: atualiza a documentação para o estudo`
