# Nivela — Plano 4: Loja de prêmios e relatórios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O aluno troca moedas por prêmios reais na Loja do app e acompanha o extrato; a equipe cadastra prêmios, entrega ou recusa resgates (com estorno) e vê indicadores reais no Início, na turma e na ficha do aluno.

**Architecture:** Duas features novas na API: `rewards` (prêmios, resgates, fila da equipe — RN11, RN12) e `dashboard` (indicadores, desempenho por categoria, atividade por dia, extrato). Movimentação de moedas só pelo `CoinLedger` (débito no resgate, estorno "uma vez" na recusa). Imagens de prêmio reaproveitam o armazenamento de imagens das questões, extraído para `src/shared/files`. Agregações por dia usam um único fragmento SQL de "dia de estudo" em `America/Fortaleza`. No painel, as features `rewards` e `dashboard`; no app, a feature `store` e o extrato no Perfil.

**Tech Stack:** o mesmo dos Planos 1–3; gráficos no web com **Recharts** (spec §3.3).

**Spec:** `docs/superpowers/specs/2026-11-08-nivela-design.md` (§5.1 linhas "Início", "Turmas", "Alunos", "Loja de prêmios"; §5.2 "Loja" e "Perfil"; §6 `rewards`, `reward_redemptions`, `coin_transactions`; §7 RN10–RN12, RN15). Regras de entrada: `docs/superpowers/plans/2026-11-08-nivela-backlog.md` (seção "Plano 4") e `docs/architecture.md` ("Ordem de travas").

## Global Constraints

- Ambiente: Windows 11 + Git Bash, Node **22.14** (não atualizar), npm 10, Docker com `nivela_db` (porta 5433, bancos `nivela` e `nivela_test`). Use portas livres; nunca encerre processos que não iniciou.
- Ler antes de codar: `CLAUDE.md`, `docs/architecture.md` (inclusive "Ordem de travas" e "Estudo"), `docs/estruturaDePastas.md`, `docs/workflow.md`.
- **Deny-by-default** em toda rota nova; staff = `Role.Admin` + `Role.Teacher`; aluno = `Role.Student`. Fora do escopo → **404** com a mensagem do recurso.
- **Escopo (RN15):** catálogo de prêmios é **da escola** (todos veem; edita quem criou ou o admin, como as questões); resgates, desempenho, extrato e indicadores de alunos sempre filtrados por `studentScope(user)` (professor: alunos das suas turmas; admin: todos).
- **Moedas:** só pelo `CoinLedger`; **regra de travas vinculante**: o perfil do aluno é o primeiro lock da transação; depois prêmio `FOR UPDATE`, depois resgate. Estorno da equipe: ler o `student_id` do resgate sem trava, travar o perfil, reler o resgate com `FOR UPDATE`, conferir o estado e só então creditar. Entregar (sem moedas) trava só o resgate.
- **Estorno uma vez no banco:** índice único parcial `coin_once_per_refund ON coin_transactions (student_id, source_id) WHERE reason = 'refund'` (`source_id` = id do resgate) e `'refund'` em `ONCE_PER_SOURCE` com predicado idêntico.
- **Dia de estudo em SQL:** um único fragmento (`studyDaySql(column)` → `((<col>) AT TIME ZONE 'America/Fortaleza')::date`) usado em toda agregação por dia, testado contra `studyDay` na virada da meia-noite.
- **Taxa de acerto:** por questão **terminada** (acerto na 1ª ou 2ª tentativa, ou 2 erros), cada questão contada **uma vez por contexto** (prática ou capítulo); `accuracy = acertadas / terminadas` em porcentagem inteira (arredondada), `null` sem questões terminadas. Nunca por tentativa.
- JSON snake_case; paginação `PaginationQueryDto`/`paginate`; listas curtas `ApiList<T>`; `@EmptyAsUndefined()`; `containsInsensitive` em buscas; `ParseIdPipe`; tipos de resposta só em `packages/api-contract` (API com `import type`).
- Imagens: mesmo padrão das questões (assinatura dos bytes, 2 MB, limite duro 5 MB, `image_url` relativo, `resolveAssetUrl` nos clientes).
- Mensagens em pt-BR, frases completas com ponto (inclusive títulos de estado vazio). Cores só por tokens.
- Prisma: SQL gerado com `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` + SQL à mão quando preciso + `npm run db:migrate -w apps/api`; **nunca** `prisma migrate reset`; drift vazio (o CI confere).
- Testes: API unit + e2e (relógio fixo do `createTestApp`, `resetDatabase`, factories, `tokenFor`); web Vitest + MSW; mobile jest-expo com o fake de `src/test/render.tsx` e `expectParams`. Saída limpa; `npx expo export --platform android` passando.
- Commits: Conventional Commits em pt-BR com escopo, **sem `Co-Authored-By`**; repositório assina via SSH — não mexer em `git config`. O implementador não faz merge nem push.

## Review Focus

1. **Dois resgates simultâneos com saldo para um só** → um `201`, outro `409 "Saldo insuficiente."`; saldo nunca negativo; estoque baixa uma vez; saldo = soma do extrato. Testes na Task 2.
2. **Última unidade disputada por dois alunos** → um `201`, outro `409 "Prêmio esgotado."`; estoque nunca negativo. Testes na Task 2.
3. **Entregar × recusar ao mesmo tempo, ou recusar duas vezes** → um único estado final; estorno e devolução de estoque **uma vez**; o segundo recebe `409 "Este resgate já foi finalizado."`. Testes na Task 2.
4. **Professor vendo/tratando resgate, extrato ou desempenho de aluno fora das suas turmas** → 404; indicadores do Início contam só o escopo. Testes nas Tasks 2 e 5.
5. **Atividade na virada do dia em Fortaleza:** respostas às 23h50 e às 00h10 (horário de Fortaleza) caem em dias diferentes. **Acerto por questão terminada:** cada (aluno, questão, contexto) conta uma vez — errar duas vezes na prática e acertar a mesma questão num capítulo são 2 terminadas e 1 certa; acertar na 2ª tentativa é 1 terminada e 1 certa, nunca 2 tentativas. Testes na Task 5.

---

### Task 1: Prêmios na API (catálogo, imagem, estorno único)

**Branch:** `feature/rewards-store` (Tasks 1–4)

**Files:**
- Modify: `prisma/schema.prisma` (`Reward`, `RewardRedemption`, enum `RedemptionStatus`) + migration `rewards` (SQL à mão: `CHECK (price BETWEEN 1 AND 100000)`, `CHECK (stock >= 0)`, `CHECK` de `rejection_reason` obrigatório quando `status = 'rejected'`, índice `reward_redemptions(status)`, índice único parcial `coin_once_per_refund`)
- Modify: `src/shared/coins/coin-ledger.ts` (`'refund'` em `ONCE_PER_SOURCE`)
- Create: `src/shared/files/image-storage.service.ts` (a pasta já tem `image-signature.ts` e `uploads-config.ts`; extrair de `src/modules/questions/question-image.service.ts`: `save(folder, buffer) → relativePath`, `remove(relativePath)`, `urlFor(path)`); `question-image.service.ts` passa a usá-lo (comportamento e testes inalterados)
- Create: `src/modules/rewards/{rewards.module.ts, rewards.controller.ts, rewards.service.ts, rewards.service.spec.ts, reward-image.service.ts, dto/…, presenters/reward.presenter.ts}`, `packages/api-contract/src/rewards.ts`
- Test: `test/rewards.e2e-spec.ts`, `test/reward-image.e2e-spec.ts`; Modify: `test/coin-ledger.e2e-spec.ts` (estorno concorrente)

**Interfaces:**
- Tabelas (spec §6): `rewards` (`id`, `created_by` FK users Restrict, `name` 2–80, `description` ≤ 500 null, `image_path` null, `price` int, `stock` int, `active` bool default true, timestamps); `reward_redemptions` (`id`, `reward_id` FK Restrict, `student_id` FK users Cascade, `price_paid` int, `status` `pending|delivered|rejected` default pending, `handled_by` FK users null Restrict, `handled_at` timestamptz null, `rejection_reason` varchar(300) null, timestamps; índices `(student_id, created_at)`, `(status)`, `(reward_id)`).
- Contrato:
  ```ts
  export interface ApiReward { id: number; name: string; description: string | null; image_url: string | null; price: number; stock: number;
    active: boolean; created_by: { id: number; name: string }; can_edit: boolean; pending_redemptions: number; updated_at: string }
  export interface ApiStoreReward { id: number; name: string; description: string | null; image_url: string | null; price: number; stock: number;
    affordable: boolean }   // vitrine do aluno: só ativos; affordable = saldo >= preço
  export type RedemptionStatus = 'pending' | 'delivered' | 'rejected';
  ```
- Rotas staff (`@Roles(Admin, Teacher)`):
  | Rota | Regras |
  |---|---|
  | `GET /rewards?page&per_page&search&status` | `Paginated<ApiReward>` por nome; `status` `active`\|`inactive` |
  | `POST /rewards` (`name`, `description?`, `price` 1–100000, `stock` 0–100000) | `201 ApiReward` (`created_by` = usuário) |
  | `GET /rewards/:id` · `PUT /rewards/:id` | 404 "Prêmio não encontrado."; editar: só quem criou ou admin → 403 "Só quem cadastrou ou um administrador pode editar este prêmio." |
  | `PATCH /rewards/:id/status` (`active`) | mesma regra de edição |
  | `POST /rewards/:id/image` · `DELETE /rewards/:id/image` | como as imagens de questão (mesmas mensagens; pasta `rewards/`) |
  Não há exclusão de prêmio (só desativar; preserva o histórico de resgates).
- Rota do aluno (`@Roles(Student)`): `GET /store/rewards` → `ApiList<ApiStoreReward>` (só ativos, por preço e nome).
- `CoinLedger.credit({ reason: 'refund', sourceType: 'redemption', sourceId })` passa a ser "uma vez".

- [ ] **Step 1:** `git checkout develop && git pull --ff-only && git checkout -b feature/rewards-store`
- [ ] **Step 2: Testes que falham** — e2e: CRUD (aluno 403; outro professor edita → 403; admin edita → 200); validações (preço 0 → 422, estoque negativo → 422); status; imagem (PNG real ok; `.png` com texto → 422 e nada no disco); `GET /store/rewards` só ativos com `affordable` pelo saldo; estorno concorrente: dois `credit('refund', mesmo source)` em transações paralelas → uma linha, saldo +preço uma vez; unit: `ImageStorageService` (guarda contra apagar fora da pasta — reaproveitar o teste da sentinela); questões continuam passando.
- [ ] **Step 3:** FAIL → schema/migration/serviços → PASS (unit, e2e, lint, typecheck, build, drift).
- [ ] **Step 4: Commits** `refactor(api): extrai o armazenamento de imagens para uso compartilhado` · `feat(api): adiciona prêmios e resgates ao schema com estorno único` · `feat(api): implementa o catálogo de prêmios` · `feat(contract): adiciona tipos de prêmio`

---

### Task 2: Resgates na API (aluno, fila da equipe, entregar, recusar)

**Branch:** `feature/rewards-store` (continuação)

**Files:**
- Create: `src/modules/rewards/{redemptions.controller.ts, store.controller.ts, redemptions.service.ts, redemptions.service.spec.ts, dto/…, presenters/redemption.presenter.ts}`
- Modify: `packages/api-contract/src/rewards.ts`
- Test: `test/redemptions.e2e-spec.ts`, `test/redemptions-concurrency.e2e-spec.ts`

**Interfaces:**
- Contrato:
  ```ts
  export interface ApiMyRedemption { id: number; reward: { id: number; name: string; image_url: string | null }; price_paid: number;
    status: RedemptionStatus; rejection_reason: string | null; created_at: string; handled_at: string | null }
  export interface ApiRedemption extends ApiMyRedemption { student: { id: number; name: string; classrooms: Array<{ id: number; name: string }> };
    handled_by: { id: number; name: string } | null }
  export interface ApiRedeemResult { redemption: ApiMyRedemption; coins_balance: number; stock: number }
  ```
- Rotas do aluno (`@Roles(Student)`):
  | Rota | Regras |
  |---|---|
  | `POST /store/rewards/:id/redeem` | Transação: perfil `FOR UPDATE` → prêmio `FOR UPDATE` → checa ativo (senão 404 "Prêmio não encontrado."), `stock > 0` (senão 409 "Prêmio esgotado."), saldo ≥ preço (senão 409 "Saldo insuficiente.") → `stock - 1` → cria resgate `pending` com `price_paid` → `CoinLedger.debit({ amount: price, reason: 'redemption', sourceType: 'redemption', sourceId: redemption.id })` → `201 ApiRedeemResult` |
  | `GET /store/redemptions?page&per_page&status` | `Paginated<ApiMyRedemption>` do próprio aluno, mais recentes primeiro |
- Rotas staff (`@Roles(Admin, Teacher)`; resgates de alunos em `studentScope(user)`; fora → 404 "Resgate não encontrado."):
  | Rota | Regras |
  |---|---|
  | `GET /redemptions?page&per_page&status&search&classroom_id` | `Paginated<ApiRedemption>`; padrão `status=pending`, mais antigos primeiro (fila) |
  | `POST /redemptions/:id/deliver` | trava **só o resgate** (`FOR UPDATE`); `pending` → `delivered` com `handled_by`/`handled_at`; já finalizado → 409 "Este resgate já foi finalizado." |
  | `POST /redemptions/:id/reject` (`reason` 3–300) | lê `student_id` sem trava → transação: perfil `FOR UPDATE` → resgate `FOR UPDATE` (estado ainda `pending`, senão 409 acima) → prêmio `FOR UPDATE` → `stock + 1` → `rejected` + motivo → `CoinLedger.credit({ amount: price_paid, reason: 'refund', sourceType: 'redemption', sourceId })` (uma vez) |
- `GET /dashboard` (Task 5) conta os `pending` por escopo; aqui não.

- [ ] **Step 1: Testes que falham** — e2e: resgate feliz (saldo − preço, estoque − 1, linha `redemption` no extrato, `price_paid` congelado mesmo se o preço mudar depois); esgotado → 409; saldo insuficiente → 409; prêmio inativo → 404; staff 403 em rotas do aluno e aluno 403 nas da equipe; fila por escopo (professor B não vê resgate de aluno de A → 404 em deliver/reject); entregar; recusar com motivo (estorno no extrato, estoque devolvido); recusar sem motivo → 422; **Review Focus 1–3** com requisições paralelas (Promise.all) e asserção de saldo = extrato, estoque e estado final; unit da ordem de travas (perfil antes do prêmio; no reject, perfil antes do resgate).
- [ ] **Step 2:** FAIL → implementar → PASS (unit, e2e, lint, typecheck, build).
- [ ] **Step 3: Commits** `feat(api): implementa o resgate de prêmios pelo aluno` · `feat(api): implementa a fila de resgates da equipe com entrega e recusa` · `feat(contract): adiciona tipos de resgate`

---

### Task 3: Loja de prêmios no painel web

**Branch:** `feature/rewards-store` (continuação)

**Files:**
- Create: `apps/web/src/features/rewards/{api/…, components/RewardFormDialog.tsx, components/RewardCard.tsx, components/RejectDialog.tsx, pages/RewardsPage/index.tsx, schemas/…, index.ts}`
- Modify: rotas (`/loja` real, lazy + `implemented`)

**Interfaces:**
- Página "Loja de prêmios" com duas abas na URL (`?tab=premios|resgates`):
  - **Prêmios:** grade de cartões de caderno (foto ou mascote, nome com marca-texto, "N moedas.", "Estoque: N.", `StatusChip`, "N resgates pendentes."), busca e status na URL, "Novo prêmio" (`RewardFormDialog`: nome, descrição, preço, estoque; imagem depois de salvar, como nas questões — reaproveitar `ImageUpload` exportando-o pelo index de `questions` ou movendo-o para `src/components`), editar, ativar/desativar (ConfirmDialog "Prêmios inativos somem da loja do aluno.").
  - **Resgates:** `DataTable` (fila padrão `pendente`; filtro de status e turma com `AsyncAutocomplete`), colunas aluno + turmas, prêmio, moedas, pedido em (dd/mm/aaaa hh:mm), status; ações "Entregar" (ConfirmDialog) e "Recusar" (`RejectDialog` com motivo obrigatório: "O aluno recebe as moedas de volta."); 409 vira aviso.

- [ ] **Step 1: Testes que falham** — criar prêmio envia o corpo certo; 422 nos campos; abas pela URL; fila pede `status=pending`; entregar e recusar enviam as rotas certas e atualizam a linha; recusar sem motivo não envia; 409 vira aviso; professor não vê ações de editar prêmio alheio (`can_edit`).
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, vitest, build).
- [ ] **Step 3: Commits** `feat(web): adiciona catálogo da loja de prêmios` · `feat(web): adiciona fila de resgates com entrega e recusa`

---

### Task 4: Loja no app

**Branch:** `feature/rewards-store` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/features/store/{api/…, components/RewardCard.tsx, components/RedeemSheet.tsx, components/RedemptionRow.tsx, screens/Store.tsx, screens/MyRedemptions.tsx, index.ts, __tests__/…}`
- Modify/Create rotas: `app/(tabs)/store.tsx` (Loja), `app/store/redemptions.tsx` (Meus resgates)

**Interfaces:**
- Loja: `StatsBar` (moedas no topo, recarregando no foco), vitrine em 2 colunas (cartão de caderno com foto via `resolveAssetUrl` ou mascote, nome, "🪙 N", "Restam N." / "Esgotado."), botão "Resgatar" desabilitado sem saldo ("Faltam N moedas.") ou sem estoque; `RedeemSheet` de confirmação ("Trocar N moedas por <prêmio>?" + "O professor entrega o prêmio na escola."); sucesso com `CoinBurst` invertido (moedas saindo) e "Pedido feito! Agora é só combinar a entrega com o professor."; 409 mostra a mensagem e recarrega a vitrine; vazio: "A loja está vazia por enquanto.".
- Meus resgates: lista com status (Pendente/Entregue/Recusado com o motivo), mais recentes primeiro, paginação "Carregar mais".

- [ ] **Step 1: Testes que falham** — vitrine lista do fake; sem saldo mostra "Faltam N moedas." e não resgata; confirmar envia `POST /store/rewards/:id/redeem`; sucesso atualiza moedas e estoque; 409 "Prêmio esgotado." mostra a mensagem; Meus resgates mostra o motivo da recusa.
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, jest, `expo export`).
- [ ] **Step 3: Commits** `feat(mobile): adiciona a vitrine da loja de prêmios` · `feat(mobile): permite resgatar prêmios e acompanhar os resgates`

---

### Task 5: Indicadores, desempenho e extrato na API

**Branch:** `feature/dashboard-reports` (Tasks 5–7)

**Files:**
- Create: `src/shared/study/study-day.sql.ts` (+ spec e e2e contra `studyDay`), `src/modules/dashboard/{dashboard.module.ts, dashboard.controller.ts, dashboard.service.ts, dashboard.service.spec.ts, performance.service.ts, coins.controller.ts, coins.service.ts, presenters/…}`, `packages/api-contract/src/dashboard.ts`
- Test: `test/dashboard.e2e-spec.ts`, `test/performance.e2e-spec.ts`, `test/coin-statement.e2e-spec.ts`

**Interfaces:**
- Contrato:
  ```ts
  export interface ApiDashboardSummary { active_students: number; active_questions: number; accuracy: number | null;   // últimos 30 dias
    students_needing_help: number; pending_redemptions: number }
  export interface ApiActivityDay { day: string; answered: number; correct: number }      // day YYYY-MM-DD em Fortaleza
  export interface ApiStudentNeedingHelp { student: { id: number; name: string }; accuracy: number; finished: number }
  export interface ApiCategoryPerformance { category: { id: number; name: string }; subject: { id: number; name: string; color: SubjectColorKey };
    finished: number; correct: number; accuracy: number | null }
  export type CoinReason = 'correct_answer' | 'plan_completed' | 'streak_bonus' | 'redemption' | 'refund';
  export interface ApiCoinTransaction { id: number; amount: number; reason: CoinReason; description: string; created_at: string }
  ```
  `description` em pt-BR pelo presenter: `correct_answer` → "Acerto: <trecho do enunciado>."; `plan_completed` → "Plano concluído: <título>."; `streak_bonus` → "Sequência de 7 dias (até <dd/mm/aaaa>)." (converter `source_id` = `dayNumber` em data, sem buscar entidade); `redemption` → "Resgate: <prêmio>."; `refund` → "Estorno: <prêmio>.".
- Rotas staff (`@Roles(Admin, Teacher)`; tudo dentro de `studentScope`/`classroomScope`):
  | Rota | Regras |
  |---|---|
  | `GET /dashboard/summary` | `ApiDashboardSummary`; "precisam de ajuda" = alunos do escopo com ≥ 5 questões terminadas nos últimos 30 dias e acerto < 50% |
  | `GET /dashboard/activity?days=14` (7–60) | `ApiList<ApiActivityDay>` — um item por dia (inclusive zeros), do mais antigo ao mais novo, agrupado por `studyDaySql(created_at)` |
  | `GET /dashboard/needing-help` | `ApiList<ApiStudentNeedingHelp>` (até 10, menor acerto primeiro) |
  | `GET /dashboard/recent-questions` | `ApiList<ApiQuestionSummary>` (5 mais recentes da escola) |
  | `GET /classrooms/:id/performance` | `ApiList<ApiCategoryPerformance>` dos alunos da turma (turma fora do escopo → 404 "Turma não encontrada.") |
  | `GET /students/:id/performance` | `ApiList<ApiCategoryPerformance>` do aluno (fora → 404 "Aluno não encontrado.") |
  | `GET /students/:id/coins?page&per_page` | `Paginated<ApiCoinTransaction>` (fora → 404) |
- Rota do aluno: `GET /me/coins?page&per_page` → `Paginated<ApiCoinTransaction>`.
- "Terminada" e "acerto" calculados em SQL por (aluno, questão, contexto) a partir de `question_attempts` (contexto = `plan_chapter_id` com `NULL` = prática): terminada se houver acerto ou tentativa 2; correta se houver acerto. Questões desativadas continuam contando no histórico.

- [ ] **Step 1: Testes que falham** — unit `studyDaySql` vs `studyDay` (23h50 e 00h10 em Fortaleza em dias diferentes; e2e com respostas gravadas nesses horários pelo relógio fixo e `activity` separando os dias — Review Focus 5); acerto por questão terminada (2 erros = terminada errada; acerto na 2ª = certa; a mesma questão em prática e capítulo conta duas vezes, uma por contexto; tentativa não terminada não conta); summary por escopo (professor B não conta alunos de A — Review Focus 4); needing-help com limiar de 5 e 50%; performance por categoria da turma e do aluno; extrato com as cinco descrições, inclusive a data do `streak_bonus`; aluno vê só o próprio extrato; aluno 403 nas rotas da equipe.
- [ ] **Step 2:** FAIL → implementar → PASS (unit, e2e, lint, typecheck, build).
- [ ] **Step 3: Commits** `feat(api): adiciona o dia de estudo em SQL para agregações` · `feat(api): implementa os indicadores do início` · `feat(api): implementa o desempenho por categoria` · `feat(api): implementa o extrato de moedas` · `feat(contract): adiciona tipos de indicadores e extrato`

---

### Task 6: Início, turma e ficha do aluno no painel

**Branch:** `feature/dashboard-reports` (continuação)

**Files:**
- Create: `apps/web/src/features/dashboard/{api/…, components/StatCard.tsx, components/ActivityChart.tsx, components/CategoryPerformanceChart.tsx, components/CoinStatement.tsx, pages/Home/index.tsx, index.ts}`
- Modify: `apps/web/src/app/routes/HomePage.tsx` → usa `features/dashboard` (rota `/` lazy); `apps/web/src/features/classrooms/pages/ClassroomDetail` (troca "Desempenho da turma — disponível em breve." pelo gráfico); `apps/web/src/features/students/pages/StudentDetail` (troca os dois placeholders pelo desempenho e pelo extrato paginado)

**Interfaces:**
- Início: saudação; 4 `StatCard` (Alunos ativos, Questões ativas, Taxa de acerto "—" quando `null`, Precisam de ajuda — com link para a lista); `ActivityChart` (Recharts, barras de respondidas e acertos por dia nos últimos 14 dias, cores dos tokens, eixo com dd/mm, tooltip em pt-BR, `aria-label` com resumo textual); listas "Precisam de ajuda" (link para `/alunos/:id`), "Questões recentes" (link para `/questoes/:id`) e "Resgates pendentes: N." com link para `/loja?tab=resgates`.
- `CategoryPerformanceChart`: barras horizontais por categoria com a cor da disciplina e "x% (c de f)."; vazio "Ainda não há questões terminadas.".
- `CoinStatement`: lista paginada (+N/−N com cor de sucesso/perigo do tema, descrição, data).

- [ ] **Step 1: Testes que falham** — Início pede as 4 rotas e mostra os números; taxa `null` mostra "—"; links certos; turma e aluno mostram o gráfico com os dados do fake; extrato paginado; estados de erro com `ResourceState`.
- [ ] **Step 2:** FAIL → implementar (instalar `recharts` no workspace web) → PASS (lint, typecheck, vitest, build).
- [ ] **Step 3: Commits** `feat(web): mostra os indicadores no início` · `feat(web): mostra o desempenho por categoria na turma e no aluno` · `feat(web): mostra o extrato de moedas do aluno`

---

### Task 7: Perfil do aluno no app (extrato e melhor sequência)

**Branch:** `feature/dashboard-reports` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/features/coins/{api/…, components/CoinStatementList.tsx, screens/CoinStatement.tsx, index.ts, __tests__/…}`, rota `app/coins.tsx`
- Modify: `apps/mobile/src/features/auth/screens/Profile.tsx` (cartão "Minhas moedas" com saldo, sequência atual e **melhor sequência** de `GET /me/stats`, últimas 3 movimentações e "Ver extrato completo")

**Interfaces:**
- Extrato completo: lista paginada ("Carregar mais"), cada linha com +N/−N, descrição e data (dd/mm/aaaa); vazio "Você ainda não movimentou moedas.".

- [ ] **Step 1: Testes que falham** — Perfil mostra saldo, sequência e melhor sequência; últimas 3 movimentações; "Ver extrato completo" abre a tela; paginação pede `page=2`; vazio.
- [ ] **Step 2:** FAIL → implementar → PASS (lint, typecheck, jest, `expo export`).
- [ ] **Step 3: Commits** `feat(mobile): mostra moedas e melhor sequência no perfil` · `feat(mobile): adiciona o extrato de moedas`

---

### Task 8: Sobras do Plano 3

**Branch:** `fix/plan3-leftovers`

**Files:**
- Modify: `apps/api/src/modules/leveling-plans/plan-completion.service.ts` (assentamento em lote), `apps/api/src/shared/study/streak.service.ts`, `packages/api-contract/src/plans.ts` (se preciso), telas do plano no app (`apps/mobile/src/features/plans`) e o progresso no painel (`apps/web/src/features/leveling-plans`)

**Interfaces:**
- Leituras da equipe que assentam conclusões (`GET /plans/:id/progress`, `GET /students/:id/plans`): `settle` de cada aluno isolado em `try/catch` com `Logger.error`; a página responde com o estado gravado daquele aluno em vez de 500.
- Plano cujos capítulos não têm nenhuma questão ativa: o app mostra "Este plano está sem questões disponíveis no momento." no lugar da barra 100% e dos capítulos "concluídos" (0/0); o painel mostra o mesmo aviso no progresso. Derivar do total de questões disponíveis (0), sem campo novo se o contrato já tiver os totais.
- `StreakService.register`: remover o ramo inalcançável "perfil inexistente" (o lock do perfil vem antes).

- [ ] **Step 1: Testes que falham** — unit: falha no `settle` de um aluno não derruba a leitura dos outros (e é logada); app e painel mostram o aviso de plano sem questões; o resto dos testes de planos e sequência continua passando.
- [ ] **Step 2:** FAIL → implementar → PASS (unit, e2e, lint, typecheck, vitest, jest).
- [ ] **Step 3: Commits** `fix(api): isola falhas no assentamento de conclusões por aluno` · `fix(mobile): avisa quando o plano está sem questões disponíveis` · `fix(web): avisa quando o plano está sem questões disponíveis` · `refactor(api): remove ramo inalcançável da sequência de estudo`

---

### Task 9: Fechamento do plano

**Branch:** `feature/plan4-docs`

**Files:**
- Modify: `docs/estruturaDePastas.md` (features `rewards`, `dashboard`, `store`, `coins`), `docs/architecture.md` (resgate/estorno e travas, estorno uma vez, `studyDaySql`, definição de acerto), spec (onde o contrato divergiu), `README.md` (como testar loja e indicadores), backlog (resolvidos + sobras do Plano 4, ledger como fonte)

- [ ] **Step 1:** Atualizar docs e backlog.
- [ ] **Step 2: Verificação geral** — `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build`, `npx expo export --platform android`, drift. Manual (portas livres): aluno com moedas resgata um prêmio, professor recusa (estorno no extrato), aluno resgata de novo, professor entrega; Início mostra os números e a atividade do dia; limpar os dados de demonstração do banco `nivela` (só o admin) e uploads; encerrar seus servidores.
- [ ] **Step 3: Commit** `docs: atualiza a documentação para a loja e os relatórios`
