# Nivela — Plano 2: Cadastros

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O painel web passa a gerenciar disciplinas, categorias, professores, questões (com imagem), turmas e alunos; o aluno vê suas turmas e entra em outras pelo código no app.

**Architecture:** Cada feature é um módulo NestJS em `apps/api/src/modules/<feature>` + uma feature em `apps/web/src/features/<feature>` (e `apps/mobile/src/features/<feature>` quando houver tela de aluno). Os tipos das respostas da API vivem num pacote novo, `@nivela/api-contract`, consumido por web e mobile e conferido pela API com `satisfies`. Listagens usam o padrão `{ data, meta: { page, per_page, total, last_page } }` já existente.

**Tech Stack:** o mesmo do Plano 1 (NestJS 12 + Prisma 7 + PostgreSQL 17; React 19 + MUI 9 + React Router 8; Expo SDK 58). Upload com `multer` (já vem com `@nestjs/platform-express`).

**Spec:** `docs/superpowers/specs/2026-11-08-nivela-design.md` (§2, §5.1, §5.2 Perfil, §6, §7 RN01, RN02, RN13, RN14, RN15). Pendências de entrada: `docs/superpowers/plans/2026-11-08-nivela-backlog.md` (seção "Plano 2").

## Global Constraints

- Ambiente: Windows 11 + Git Bash, Node **22.14** (não atualizar; a API usa Nest CLI 11 + transformer ESM do Jest — ver `docs/architecture.md`), npm 10, Docker Desktop aberto (`nivela_db`, porta 5433, bancos `nivela` e `nivela_test`).
- Ler antes de codar: `CLAUDE.md`, `docs/architecture.md`, `docs/estruturaDePastas.md`, `docs/workflow.md`.
- **Autorização deny-by-default:** toda rota nova declara `@Roles(...)`, `@AnyAuthenticated()` ou `@Public()`; o teste `test/route-authorization.e2e-spec.ts` falha se faltar. Staff = `Role.Admin` + `Role.Teacher`.
- **JSON em snake_case** em requisições e respostas; datas em ISO 8601; listagens paginadas com `PaginationQueryDto` + `toPrismaPage` + `paginate` (`src/shared/pagination`).
- **Mensagens em pt-BR**, frases completas terminando em ponto; 404 de recurso = `"<Recurso> não encontrado(a)."`; regra de negócio violada = `BusinessRuleException` (409); unicidade violada = `isUniqueViolation(error, '<constraint>')` (`src/shared/prisma`) → 422 no campo.
- **Prisma:** migration nova por feature com `npx prisma migrate dev --create-only --name <nome>` + `npm run db:migrate -w apps/api`; **nunca** `prisma migrate reset` nem `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Se o `migrate dev` pedir reset → parar e reportar NEEDS_CONTEXT.
- **Tipos de resposta** declarados em `packages/api-contract` e usados pela API (`satisfies`) e pelos clientes; nada de tipo de resposta duplicado em web/mobile.
- Web: features em `src/features/<feature>/{api,pages,components,schemas,index.ts}`; telas só chamam `*.action.ts`; cores só pelo tema; usar o kit da Task 2 (tabela, diálogos, avisos, listagem com filtros na URL).
- Mobile: features em `src/features/<feature>/{api,screens,components,schemas,index.ts}`; telas em `app/` importam só do `index.ts` da feature.
- Testes: API = unitário dos services + e2e (`npm run test:e2e -w apps/api`, `resetDatabase` por suíte, factories em `test/helpers/factories.ts`); web = Vitest + MSW; mobile = jest-expo com o fake de `src/test/render.tsx`. Saída limpa.
- Commits: Conventional Commits em pt-BR com escopo (`feat(api): …`), pequenos, sem linha `Co-Authored-By`. Repositório já assina via SSH como Henrique Douglas — não mexer em `git config`.
- Gitflow: cada branch nasce de `develop` atualizado; **o implementador não faz merge nem push** — o controller integra com `--no-ff` depois da revisão.

## Review Focus

1. **Professor abrindo turma/aluno de outro professor pelo id** (`GET /classrooms/9`, `GET /students/31`) → 404 "Turma não encontrada." / "Aluno não encontrado.", sem vazar dados. Testes nas Tasks 10.
2. **Questão inconsistente** — categoria de outra disciplina, letras repetidas, menos de 5 alternativas, `correct_letter` fora de A–E → 422 no campo certo e nada gravado. Testes na Task 8.
3. **Arquivo que finge ser imagem** (`.png` com conteúdo de texto) ou imagem > 2 MB → 422 e nenhum arquivo salvo em disco. Testes na Task 8.
4. **Excluir disciplina/categoria em uso** → 409 e nada excluído; **nomes que só diferem em maiúsculas/espaços** ("Matemática" × " matemática ") → 422 de duplicidade. Testes na Task 4.
5. **Professor desativado** → as sessões abertas dele param na hora (401) e ele não consegue mais logar. Testes na Task 6.

---

### Task 1: Pendências da fundação e contrato compartilhado

**Branch:** `feature/plan2-foundation`

**Files:**
- Modify: `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/guards/roles.guard.spec.ts`, `apps/api/src/modules/auth/token.service.ts` (+ spec), `apps/api/src/modules/auth/presenters/user.presenter.ts`
- Create: `packages/api-contract/{package.json,tsconfig.json,src/index.ts,src/user.ts,src/errors.ts,src/pagination.ts,src/parseApiError.ts,src/__tests__/parseApiError.test.ts}`
- Modify (migração para o contrato): `apps/web/src/types/user.ts` (remover), `apps/web/src/lib/apiError.ts` (remover), `apps/mobile/src/types/user.ts` (remover), `apps/mobile/src/lib/apiError.ts` (remover) e todos os imports; `package.json` de web, mobile e api ganham `"@nivela/api-contract": "*"`
- Modify: `docs/architecture.md`, `docs/estruturaDePastas.md` (o pacote e a regra "tipos de resposta só no contrato")

**Interfaces:**
- Produces:
  - `RolesGuard`: metadata do **handler** vence a da **classe** para as três chaves (`IS_PUBLIC_KEY`, `ANY_AUTHENTICATED_KEY`, `ROLES_KEY`): resolver primeiro no handler; só olhar a classe se o handler não declarar nenhuma das três. Mesma regra no `AuthGuard` para `@Public`.
  - `@nivela/api-contract` (TS puro, `main: src/index.ts`, sem build, `axios` como `peerDependency`):
    ```ts
    export type Role = 'admin' | 'teacher' | 'student';
    export interface ApiUser { id: number; name: string; email: string; role: Role }
    export interface ErrorBody { message: string; errors?: Record<string, string[]> }
    export interface PaginationMeta { page: number; per_page: number; total: number; last_page: number }
    export interface Paginated<T> { data: T[]; meta: PaginationMeta }
    export interface ApiErrorInfo { status: number | null; message: string; fieldErrors: Record<string, string[]> }
    export function parseApiError(error: unknown): ApiErrorInfo; // mesmo comportamento do apps/web/src/lib/apiError.ts atual
    ```
  - Web e mobile: `User` passa a ser `ApiUser` do contrato (pode reexportar como `User` em `src/types` se reduzir churn — sem redefinir).
  - API: `presentUser(...) satisfies ApiUser`; `Paginated`/`PaginationMeta` de `src/shared/pagination/paginate.ts` passam a ser os do contrato (reexport).
  - `TokenService.resolve`: falha no `deleteMany` do token expirado é capturada e logada (devolve `null` mesmo assim).

- [ ] **Step 1:** `git checkout develop && git pull --ff-only && git checkout -b feature/plan2-foundation`
- [ ] **Step 2: Testes que falham**
  ```ts
  // roles.guard.spec.ts
  it('handler @Roles(Admin) vence @AnyAuthenticated da classe', /* aluno → ForbiddenException; admin → true */);
  it('handler @Roles vence @Public da classe', /* sem usuário → ForbiddenException */);
  it('handler @AnyAuthenticated vence @Roles(Admin) da classe', /* aluno → true */);
  // auth.guard.spec.ts
  it('handler sem @Public numa classe @Public exige token', /* sem Authorization → 401 */);
  // token.service.spec.ts
  it('token expirado: falha ao apagar não vira 500', /* deleteMany rejeita → resolve devolve null e loga */);
  // packages/api-contract parseApiError.test.ts — portar os casos de apps/web/src/lib (rede, corpo malformado, 422 com errors, mensagem não-string)
  ```
- [ ] **Step 3:** Run `npm test -w apps/api -- roles.guard auth.guard token.service && npm test -w packages/api-contract` → FAIL.
- [ ] **Step 4:** Implementar guard, token service e o pacote; migrar web/mobile/api para o contrato; remover os arquivos duplicados.
- [ ] **Step 5:** Run `npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api` (raiz) → PASS.
- [ ] **Step 6: Commits** `fix(api): metadata do handler prevalece sobre a do controller na autorização` · `fix(api): falha ao apagar token expirado não derruba a requisição` · `feat(contract): cria pacote de contrato da API compartilhado` · `refactor(web): usa os tipos e o parser de erros do contrato` · `refactor(mobile): usa os tipos e o parser de erros do contrato` · `docs: documenta o pacote de contrato`

---

### Task 2: Kit de telas de cadastro do painel web

**Branch:** `feature/web-crud-kit`

**Files:**
- Move/Modify: `apps/web/src/features/auth/components/PasswordField.tsx` → `apps/web/src/components/PasswordField/index.tsx` (corrigir: mesclar o `slotProps.input` do chamador em vez de descartar)
- Create: `apps/web/src/components/DataTable/index.tsx`, `apps/web/src/components/ConfirmDialog/index.tsx`, `apps/web/src/components/FormDialog/index.tsx`, `apps/web/src/components/StatusChip/index.tsx`, `apps/web/src/components/SearchField/index.tsx`, `apps/web/src/lib/notify/{NotifyProvider.tsx,useNotify.ts}`, `apps/web/src/hooks/useListQuery.ts`
- Modify: `apps/web/src/app/App.tsx` (NotifyProvider), `apps/web/src/app/routes/index.tsx` (rotas com `lazy()` + `Suspense` com spinner)
- Test: um `*.test.tsx` por componente/hook novo

**Interfaces:**
- Produces:
  - `DataTable<T>(props: { columns: Array<{ key: string; header: string; render: (row: T) => ReactNode; width?: number }>; rows: T[]; getRowId: (row: T) => number; loading: boolean; error?: string | null; onRetry?: () => void; meta?: PaginationMeta; onPageChange?: (page: number) => void; emptyTitle: string; emptyDescription?: string; onRowClick?: (row: T) => void })` — cabeçalho com borda "de caneta", linhas zebradas com a pauta do tema, paginação MUI (`TablePagination` com 15 por página), estado vazio com `EmptyState` + mascote, estado de erro com botão "Tentar de novo".
  - `ConfirmDialog(props: { open: boolean; title: string; description: ReactNode; confirmLabel: string; tone?: 'danger' | 'primary'; loading?: boolean; onConfirm: () => void; onClose: () => void })`.
  - `FormDialog(props: { open: boolean; title: string; submitLabel: string; loading?: boolean; onSubmit: () => void; onClose: () => void; children: ReactNode })` — `<form>` com Enter enviando; fecha com Esc só quando não está enviando.
  - `useNotify(): { success(message: string): void; error(message: string): void }` (Snackbar no rodapé, 4 s).
  - `useListQuery<F extends Record<string, string>>(defaults: F): { page: number; filters: F; setPage(p: number): void; setFilter<K extends keyof F>(key: K, value: F[K]): void }` — estado na **query string** (`?page=2&search=fra&subject_id=3`), trocar filtro volta para a página 1; busca com debounce de 300 ms no `SearchField`.
  - `StatusChip({ active }: { active: boolean })` → "Ativo"/"Inativo" com cores `success`/`textMuted` do tema.
  - `PasswordField` exportado de `src/components/PasswordField`.

- [ ] **Step 1:** branch a partir de `develop` (já com a Task 1 integrada).
- [ ] **Step 2: Testes que falham** — `DataTable` (renderiza linhas; vazio mostra `emptyTitle`; erro mostra "Tentar de novo" e chama `onRetry`; trocar página chama `onPageChange(2)`); `ConfirmDialog` (confirmar/cancelar; botão desabilitado com `loading`); `FormDialog` (Enter envia; Esc não fecha enquanto `loading`); `useListQuery` (lê `?page=3&search=x`; `setFilter('search','y')` → URL `?search=y` sem `page`); `useNotify` (mostra e some); `PasswordField` (alterna visibilidade e respeita `slotProps.input` do chamador).
- [ ] **Step 3:** Run `npm test -w apps/web` → FAIL.
- [ ] **Step 4:** Implementar. Rotas com `lazy()` por página (as páginas ainda "Em breve" continuam funcionando).
- [ ] **Step 5:** Run `npm run lint -w apps/web && npm run typecheck -w apps/web && npm test -w apps/web && npm run build -w apps/web` → PASS e o aviso de chunk > 500 kB some ou diminui (anotar o tamanho no relatório).
- [ ] **Step 6: Commits** `refactor(web): move o campo de senha para componentes compartilhados` · `feat(web): adiciona tabela, diálogos e avisos para cadastros` · `feat(web): adiciona listagem com filtros na URL` · `perf(web): carrega as páginas sob demanda`

---

### Task 3: Cores e ícones de disciplina nos tokens

**Branch:** `feature/subjects-categories` (as Tasks 3, 4 e 5 usam a mesma branch)

**Files:**
- Create: `packages/design-tokens/src/subjects.ts`, `packages/design-tokens/src/__tests__/subjects.test.ts`
- Modify: `packages/design-tokens/src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SubjectColorKey = 'teal' | 'coral' | 'violet' | 'sky' | 'amber' | 'rose';
  export const subjectColors: Record<ThemeMode, Record<SubjectColorKey, { background: string; foreground: string }>>;
  export type SubjectIconKey = 'calculator' | 'book' | 'flask' | 'globe' | 'palette' | 'language';
  export const subjectIconKeys: readonly SubjectIconKey[];
  export const subjectColorKeys: readonly SubjectColorKey[];
  ```
  `teal` e `coral` reaproveitam a marca; os outros quatro são novos e precisam combinar com o Caderno Vivo.

- [ ] **Step 1: Teste que falha** — `it.each` sobre modo × cor: `contrastRatio(foreground, background) >= 4.5`; `subjectColorKeys` e `subjectIconKeys` têm 6 itens sem repetição.
- [ ] **Step 2:** Run `npm test -w packages/design-tokens` → FAIL. **Step 3:** implementar. **Step 4:** PASS + `typecheck`.
- [ ] **Step 5: Commit** `feat(tokens): adiciona cores e ícones de disciplina`

---

### Task 4: Disciplinas e categorias na API

**Branch:** `feature/subjects-categories` (continuação)

**Files:**
- Modify: `prisma/schema.prisma` (models `Subject`, `Category`) + migration `subjects_categories` (com índices únicos funcionais em SQL: `CREATE UNIQUE INDEX subjects_name_key ON subjects (lower(name));` e `CREATE UNIQUE INDEX categories_subject_name_key ON categories (subject_id, lower(name));`)
- Create: `src/modules/subjects/{subjects.module.ts,subjects.controller.ts,subjects.service.ts,subjects.service.spec.ts,dto/subject.dto.ts,presenters/subject.presenter.ts}`, `src/modules/categories/{…mesma anatomia…}`
- Create: `packages/api-contract/src/subjects.ts` (+ export no index)
- Modify: `src/app.module.ts`, `test/helpers/factories.ts` (`createSubject`, `createCategory`)
- Test: `test/subjects.e2e-spec.ts`, `test/categories.e2e-spec.ts`

**Interfaces:**
- Tabelas (spec §6): `subjects` (`id`, `name` varchar(60), `color` varchar(20), `icon` varchar(20), timestamps TIMESTAMPTZ(3)); `categories` (`id`, `subject_id` FK → subjects **Restrict**, `name` varchar(80), timestamps).
- Contrato:
  ```ts
  export interface ApiSubject { id: number; name: string; color: SubjectColorKey; icon: SubjectIconKey; categories_count: number; questions_count: number }
  export interface ApiCategory { id: number; name: string; subject: { id: number; name: string; color: SubjectColorKey }; questions_count: number }
  ```
  (`SubjectColorKey`/`SubjectIconKey` como uniões literais no contrato — iguais às dos tokens; `questions_count` = 0 até a Task 8 criar a tabela, depois passa a contar.)
- Rotas (todas `@Roles(Admin, Teacher)`):
  | Rota | Corpo / query | Sucesso | Erros |
  |---|---|---|---|
  | `GET /subjects` | — | `200 { data: ApiSubject[] }` ordenado por nome | — |
  | `POST /subjects` | `name` (2–60, trim), `color` ∈ SubjectColorKey, `icon` ∈ SubjectIconKey | `201 ApiSubject` | 422 `errors.name ["Já existe uma disciplina com esse nome."]`; cor/ícone inválidos → `["Escolha uma cor válida."]` / `["Escolha um ícone válido."]` |
  | `PUT /subjects/:id` | mesmo corpo | `200 ApiSubject` | 404 `"Disciplina não encontrada."`; 422 duplicidade |
  | `DELETE /subjects/:id` | — | `204` | 409 `"Não é possível excluir: a disciplina tem categorias ou questões."` |
  | `GET /categories` | `?subject_id` opcional | `200 { data: ApiCategory[] }` por disciplina e nome | 422 `subject_id` não numérico |
  | `POST /categories` | `subject_id`, `name` (2–80, trim) | `201 ApiCategory` | 422 `errors.subject_id ["Disciplina não encontrada."]`; `errors.name ["Já existe uma categoria com esse nome nessa disciplina."]` |
  | `PUT /categories/:id` | `name` (só o nome muda; mudar a disciplina não é permitido) | `200` | 404 `"Categoria não encontrada."`; 422 duplicidade |
  | `DELETE /categories/:id` | — | `204` | 409 `"Não é possível excluir: a categoria tem questões."` |
- Duplicidade **pelo índice único** (`isUniqueViolation(error, 'subjects_name_key')` / `'categories_subject_name_key'`) — não fazer busca prévia com `mode: 'insensitive'` (vira ILIKE com curingas, ver Plano 1).

- [ ] **Step 1: Testes que falham** (e2e) — CRUD feliz das duas; aluno → 403 em todas; " matemática " após "Matemática" → 422; mesma categoria em disciplinas diferentes → OK; excluir disciplina com categoria → 409 e continua existindo; excluir categoria sem questões → 204; `PUT` de id inexistente → 404; `GET /categories?subject_id=X` filtra; contagens corretas.
- [ ] **Step 2:** Run `npm run test:e2e -w apps/api` → FAIL. **Step 3:** schema + migration + módulos. **Step 4:** PASS + lint + typecheck + unit.
- [ ] **Step 5: Commits** `feat(api): adiciona disciplinas e categorias ao schema` · `feat(api): implementa cadastro de disciplinas` · `feat(api): implementa cadastro de categorias` · `feat(contract): adiciona tipos de disciplina e categoria`

---

### Task 5: Disciplinas e categorias no painel web

**Branch:** `feature/subjects-categories` (continuação; merge no fim)

**Files:**
- Create: `apps/web/src/features/subjects/{api/subjects.api.ts,api/subjects.action.ts,components/SubjectBadge.tsx,components/SubjectIcon.tsx,components/SubjectFormDialog.tsx,pages/SubjectList/index.tsx,schemas/subject.schema.ts,index.ts}`, `apps/web/src/features/categories/{api/…,components/CategoryFormDialog.tsx,pages/CategoryList/index.tsx,schemas/category.schema.ts,index.ts}`
- Modify: `apps/web/src/app/routes/index.tsx` (`/disciplinas`, `/categorias` reais)
- Test: `SubjectList.test.tsx`, `CategoryList.test.tsx`

**Interfaces:**
- Consumes: kit da Task 2, `ApiSubject`/`ApiCategory`, `subjectColors`/`subjectIconKeys`.
- Produces: `SubjectBadge({ subject: { name: string; color: SubjectColorKey } })` e `SubjectIcon({ icon: SubjectIconKey })` exportados pelo `index.ts` de `subjects` (usados por questões e categorias). Ícones MUI: calculator→`Calculate`, book→`MenuBook`, flask→`Science`, globe→`Public`, palette→`Palette`, language→`Translate`.
- Disciplinas: cards em grade (ícone, nome com marca-texto na cor da disciplina, "N categorias · M questões"), botão "Nova disciplina", diálogo com nome + seletor visual de cor (bolinhas) e de ícone; editar; excluir com `ConfirmDialog` (409 vira aviso de erro).
- Categorias: `DataTable` com filtro por disciplina (`useListQuery({ subject_id: '' })`), coluna disciplina com `SubjectBadge`, diálogo de criar/editar (disciplina só na criação).

- [ ] **Step 1: Testes que falham** — lista renderiza cards; criar envia `{ name, color, icon }` e mostra aviso "Disciplina criada."; 422 aparece no campo nome; excluir com 409 mostra a mensagem da API; categorias filtram por disciplina pela URL; editar categoria não mostra seletor de disciplina.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** `lint`, `typecheck`, `test` do web → PASS.
- [ ] **Step 5: Commits** `feat(web): adiciona cadastro de disciplinas` · `feat(web): adiciona cadastro de categorias`

---

### Task 6: Professores na API

**Branch:** `feature/teachers` (Tasks 6 e 7)

**Files:**
- Create: `src/modules/teachers/{teachers.module.ts,teachers.controller.ts,teachers.service.ts,teachers.service.spec.ts,dto/create-teacher.dto.ts,dto/update-teacher.dto.ts,dto/teacher-status.dto.ts,dto/teacher-password.dto.ts,dto/list-teachers.query.ts,presenters/teacher.presenter.ts}`, `packages/api-contract/src/teachers.ts`
- Modify: `src/modules/auth/auth.module.ts` (exportar `TokenService` se ainda não), `src/app.module.ts`
- Test: `test/teachers.e2e-spec.ts`

**Interfaces:**
- Consumes: `TokenService.revokeOthers(userId, keepPlain?, tx?)` (sem `keepPlain` revoga todos), `isUniqueViolation(error, 'users_email_key')`, `@NormalizeEmail()`.
- Contrato: `export interface ApiTeacher { id: number; name: string; email: string; active: boolean; classrooms_count: number; created_at: string }`.
- Rotas (todas `@Roles(Admin)`):
  | Rota | Corpo / query | Sucesso | Erros |
  |---|---|---|---|
  | `GET /teachers` | `page`, `per_page`, `search` (nome ou e-mail, parcial e sem diferenciar maiúsculas; `%` e `_` digitados são literais), `status` (`active`\|`inactive`) | `200 Paginated<ApiTeacher>` por nome | — |
  | `POST /teachers` | `name` (2–120), `email`, `password` (8–72) | `201 ApiTeacher` | 422 `email ["Este e-mail já está cadastrado."]` |
  | `PUT /teachers/:id` | `name`, `email` | `200` | 404 `"Professor não encontrado."` (também para id de aluno/admin); 422 e-mail duplicado |
  | `PATCH /teachers/:id/status` | `active: boolean` | `200 ApiTeacher` | desativar revoga **todas** as sessões dele na mesma transação |
  | `PUT /teachers/:id/password` | `password`, `password_confirmation` | `204` | revoga todas as sessões; 422 confirmação |
- Busca textual: criar helper `containsInsensitive(term: string)` em `src/shared/prisma/` que devolve o filtro Prisma de busca parcial sem diferenciar maiúsculas **tratando `%`, `_` e `\` como literais** (verificar na prática se o Prisma 7 já escapa curingas em `contains` antes de escapar de novo — o teste decide) — usado por todas as buscas deste plano.

- [ ] **Step 1: Testes que falham** — CRUD; professor/aluno → 403; com "joao_silva" e "joaoxsilva" cadastrados, busca "joao_" encontra só "joao_silva" e busca "%" não encontra nada; desativar → token do professor recebe 401 no `GET /auth/me` e login dele dá 403 "Usuário desativado."; reativar → login volta; trocar senha revoga sessões; `PUT /teachers/<id de aluno>` → 404.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** e2e + unit + lint + typecheck → PASS.
- [ ] **Step 5: Commits** `feat(api): adiciona busca textual segura` · `feat(api): implementa cadastro de professores` · `feat(contract): adiciona tipos de professor`

---

### Task 7: Professores no painel web

**Branch:** `feature/teachers` (continuação; merge no fim)

**Files:**
- Create: `apps/web/src/features/teachers/{api/…,components/TeacherFormDialog.tsx,components/TeacherPasswordDialog.tsx,pages/TeacherList/index.tsx,schemas/teacher.schema.ts,index.ts}`
- Modify: rotas (`/professores` real, só admin)
- Test: `TeacherList.test.tsx`

**Interfaces:**
- `DataTable` com busca e filtro de status na URL; colunas nome, e-mail, turmas, `StatusChip`, ações (editar, redefinir senha, ativar/desativar com `ConfirmDialog` explicando que as sessões serão encerradas). Formulário de criação com `PasswordField` ("Senha inicial") e aviso "Combine com o professor para trocar a senha no primeiro acesso.".

- [ ] **Step 1: Testes que falham** — lista + busca atualiza URL; criar envia corpo certo; 422 de e-mail no campo; desativar pede confirmação e atualiza a linha; professor logado não vê a rota (redireciona).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (lint, typecheck, test).
- [ ] **Step 5: Commit** `feat(web): adiciona cadastro de professores`

---

### Task 8: Questões na API (com imagem)

**Branch:** `feature/questions` (Tasks 8 e 9)

**Files:**
- Modify: `prisma/schema.prisma` (`Question`, `QuestionOption`, enum `Difficulty`) + migration `questions`; `src/app.factory.ts` (servir `UPLOADS_DIR` em `/uploads` — usar `NestExpressApplication.useStaticAssets` no `main.ts` e no `create-test-app.ts`, ou `express.static` dentro de `configureApp`); `src/common/filters/http-exception.filter.ts` (mensagens de `ParseFilePipe`, `ParseArrayPipe`, `ParseUUIDPipe` em pt-BR); `.env.example`/`.env.test` (`UPLOADS_DIR`, `PUBLIC_URL`)
- Create: `src/modules/questions/{questions.module.ts,questions.controller.ts,questions.service.ts,questions.service.spec.ts,question-image.service.ts,question-image.service.spec.ts,dto/question.dto.ts,dto/list-questions.query.ts,dto/question-status.dto.ts,presenters/question.presenter.ts}`, `src/shared/files/image-signature.ts` (+ spec), `packages/api-contract/src/questions.ts`
- Modify: subjects/categories services para contar questões e bloquear exclusão (RN da Task 4 passa a valer de verdade)
- Test: `test/questions.e2e-spec.ts`, `test/question-image.e2e-spec.ts`

**Interfaces:**
- Tabelas: `questions` (`id`, `author_id` FK users Restrict, `subject_id` FK Restrict, `category_id` FK Restrict, `statement` text, `image_path` varchar(255) null, `difficulty` enum `easy|medium|hard`, `explanation` text, `active` bool default true, timestamps; índice `(subject_id, category_id, active)`); `question_options` (`id`, `question_id` FK Cascade, `letter` char(1), `text` text, `is_correct` bool; único `(question_id, letter)`).
- Contrato:
  ```ts
  export type Difficulty = 'easy' | 'medium' | 'hard';
  export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';
  export interface ApiQuestionSummary { id: number; statement_excerpt: string; difficulty: Difficulty; active: boolean; has_image: boolean;
    subject: { id: number; name: string; color: SubjectColorKey }; category: { id: number; name: string }; author: { id: number; name: string }; updated_at: string }
  export interface ApiQuestion extends Omit<ApiQuestionSummary, 'statement_excerpt' | 'has_image'> {
    statement: string; explanation: string; image_url: string | null; correct_letter: OptionLetter;
    options: Array<{ letter: OptionLetter; text: string }>; can_edit: boolean; created_at: string }
  export interface QuestionPayload { subject_id: number; category_id: number; statement: string; difficulty: Difficulty; explanation: string;
    options: Array<{ letter: OptionLetter; text: string }>; correct_letter: OptionLetter }
  ```
  `statement_excerpt` = primeiros 140 caracteres sem quebras de linha + "…" se cortado. `can_edit` = autor ou admin.
- Rotas (`@Roles(Admin, Teacher)`):
  | Rota | Sucesso | Erros |
  |---|---|---|
  | `GET /questions?page&per_page&search&subject_id&category_id&difficulty&status` | `200 Paginated<ApiQuestionSummary>` por `updated_at desc` | — |
  | `GET /questions/:id` | `200 ApiQuestion` | 404 `"Questão não encontrada."` |
  | `POST /questions` (`QuestionPayload`) | `201 ApiQuestion` (autor = usuário logado) | 422: `statement` 10–5000; `explanation` 1–5000; `options ["Informe as 5 alternativas, de A a E."]` (≠ 5 ou letras repetidas/fora de A–E); `options.<i>.text ["Informe o texto da alternativa."]`; `correct_letter ["Escolha a alternativa correta."]`; `subject_id ["Disciplina não encontrada."]`; `category_id ["A categoria não pertence à disciplina."]` |
  | `PUT /questions/:id` | `200 ApiQuestion` (opções substituídas na mesma transação) | 403 `"Só o autor ou um administrador pode editar esta questão."` (RN02) |
  | `PATCH /questions/:id/status` (`active`) | `200 ApiQuestion` | 403 idem |
  | `POST /questions/:id/image` (multipart, campo `image`) | `200 { image_url }` (substitui e apaga a anterior) | 422 `errors.image`: sem arquivo `["Envie uma imagem."]`; tipo `["Envie uma imagem JPG, PNG ou WEBP."]` (checar **assinatura dos bytes**, não só extensão/mimetype); > 2 MB `["A imagem deve ter no máximo 2 MB."]`; limite duro do multer 5 MB → 413 "Arquivo muito grande."; 403 idem |
  | `DELETE /questions/:id/image` | `204` (apaga o arquivo) | 403 idem |
  Não há exclusão de questão no Plano 2 (só desativar; RN02 completa no Plano 3 quando existirem tentativas).
- Imagens em `UPLOADS_DIR/questions/<question_id>-<uuid>.<ext>` (default `uploads`; nos e2e, pasta temporária); `image_url` = `${PUBLIC_URL}/uploads/questions/<arquivo>` (default `http://localhost:8000`). Nenhum arquivo fica no disco se a validação falhar.
- `isAllowedImage(buffer: Buffer): 'jpg' | 'png' | 'webp' | null` em `src/shared/files/image-signature.ts` (sem dependência ESM nova).

- [ ] **Step 1: Testes que falham** — e2e: criar feliz (opções voltam ordenadas A–E, `correct_letter` certo); cada erro 422 da tabela; categoria de outra disciplina → 422 e nada gravado; editar como outro professor → 403, como admin → 200; desativar/ativar; filtros (`subject_id`, `category_id`, `difficulty`, `status`, `search` com "%" não casa tudo); paginação; aluno → 403; upload PNG real (fixture pequena gerada no teste) → `image_url` acessível via `GET` estático; `.png` com texto → 422 e pasta vazia; 3 MB → 422; trocar imagem apaga a antiga; disciplina com questão não pode ser excluída (409). Unit: `isAllowedImage` (jpg/png/webp/texto/vazio), excerpt.
- [ ] **Step 2:** FAIL. **Step 3:** schema + migration + módulo + filtro. **Step 4:** PASS (e2e, unit, lint, typecheck, `build`).
- [ ] **Step 5: Commits** `feat(api): adiciona questões e alternativas ao schema` · `feat(api): implementa banco de questões` · `feat(api): implementa imagem das questões com validação por assinatura` · `fix(api): traduz mensagens dos pipes de arquivo, lista e UUID` · `feat(contract): adiciona tipos de questão`

---

### Task 9: Questões no painel web

**Branch:** `feature/questions` (continuação; merge no fim)

**Files:**
- Create: `apps/web/src/features/questions/{api/…,components/QuestionFilters.tsx,components/OptionsEditor.tsx,components/ImageUpload.tsx,components/DifficultyChip.tsx,pages/QuestionList/index.tsx,pages/QuestionForm/index.tsx,schemas/question.schema.ts,index.ts}`
- Modify: rotas (`/questoes`, `/questoes/nova`, `/questoes/:id`)
- Test: `QuestionList.test.tsx`, `QuestionForm.test.tsx`, `question.schema.test.ts`

**Interfaces:**
- Lista: `DataTable` com filtros na URL (busca, disciplina, categoria dependente da disciplina, dificuldade, status), colunas enunciado (trecho), `SubjectBadge`, categoria, `DifficultyChip` (Fácil/Médio/Difícil), autor, `StatusChip`; clique abre `/questoes/:id`; botão "Nova questão".
- Formulário (criar e editar na mesma página): disciplina → categoria (dependente), dificuldade, enunciado (multilinha), `OptionsEditor` com as 5 alternativas A–E em linhas de caderno e um `Radio` "correta" por linha (só uma), explicação ("Explique a resolução — o aluno vê depois de responder."), `ImageUpload` (só depois que a questão existe: na criação, salvar primeiro e depois enviar; prévia, trocar, remover, validação no cliente de tipo e 2 MB com as mesmas mensagens da API). Questão de outro autor (sem `can_edit`) abre em modo leitura com aviso.
- Schema zod espelha a validação da API (mesmas mensagens).

- [ ] **Step 1: Testes que falham** — filtros mudam a URL e a requisição; categoria fica desabilitada sem disciplina; criar envia `QuestionPayload` exato e redireciona para `/questoes/:id` com aviso "Questão criada."; sem alternativa correta → erro no cliente, nenhuma requisição; 422 da API em `options.2.text` aparece na linha C; modo leitura sem `can_edit`; upload de arquivo > 2 MB recusado no cliente; upload ok mostra a prévia.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (lint, typecheck, test, build).
- [ ] **Step 5: Commits** `feat(web): adiciona banco de questões com filtros` · `feat(web): adiciona formulário de questão com alternativas e imagem`

---

### Task 10: Turmas e alunos na API

**Branch:** `feature/classrooms` (Tasks 10, 11 e 12)

**Files:**
- Create: `src/modules/classrooms/{classrooms.controller.ts,classrooms.service.ts,classrooms.service.spec.ts,student-classrooms.controller.ts,dto/…,presenters/classroom.presenter.ts}`, `src/modules/students/{students.module.ts,students.controller.ts,students.service.ts,students.service.spec.ts,dto/list-students.query.ts,presenters/student.presenter.ts}`, `packages/api-contract/src/{classrooms.ts,students.ts}`
- Modify: `src/modules/classrooms/classrooms.module.ts`, `join-code.service.ts` (`generate` em retry contra P2002 ao gravar: `createWithUniqueCode(tx, data)` / `regenerate(id)` com até 10 tentativas usando `isUniqueViolation(error, 'classrooms_join_code_key')`), `src/modules/auth/auth.service.ts` (reusar a validação de código da turma num service compartilhado: `ClassroomsService.findJoinable(code)` → mesma mensagem), `src/app.module.ts`
- Test: `test/classrooms.e2e-spec.ts`, `test/students.e2e-spec.ts`, `test/student-classrooms.e2e-spec.ts`

**Interfaces:**
- Contrato:
  ```ts
  export interface ApiClassroomSummary { id: number; name: string; school_year: string | null; join_code: string; active: boolean; students_count: number; teacher: { id: number; name: string }; created_at: string }
  export interface ApiClassroom extends ApiClassroomSummary { students: Array<{ id: number; name: string; email: string; active: boolean; joined_at: string }> }
  export interface ApiStudentSummary { id: number; name: string; email: string; active: boolean; classrooms: Array<{ id: number; name: string }>; coins_balance: number; created_at: string }
  export interface ApiStudent extends ApiStudentSummary { current_streak: number; best_streak: number }
  export interface ApiMyClassroom { id: number; name: string; school_year: string | null; teacher: { name: string }; joined_at: string }
  ```
- Visibilidade (RN15): professor só enxerga turmas com `teacher_id = ele` e alunos matriculados nelas; admin enxerga tudo. Fora disso → **404** (nunca 403, para não confirmar que existe).
- Rotas staff (`@Roles(Admin, Teacher)`):
  | Rota | Sucesso | Erros |
  |---|---|---|
  | `GET /classrooms?page&per_page&search&status` | `200 Paginated<ApiClassroomSummary>` por nome | — |
  | `POST /classrooms` (`name` 2–120, `school_year` ≤40 opcional; admin precisa de `teacher_id`) | `201 ApiClassroom` com código gerado | 422 `teacher_id ["Informe o professor da turma."]` / `["Professor não encontrado."]` (admin) |
  | `GET /classrooms/:id` | `200 ApiClassroom` | 404 `"Turma não encontrada."` |
  | `PUT /classrooms/:id` (`name`, `school_year`, `active`) | `200` | 404 |
  | `POST /classrooms/:id/join-code` | `200 { join_code }` novo | 404 |
  | `POST /classrooms/:id/students` (`name`, `email`, `password` 8–72) | `201` aluno criado (perfil + matrícula, transação) | 422 `email ["Este e-mail já está cadastrado. O aluno pode entrar na turma pelo código."]` |
  | `DELETE /classrooms/:id/students/:studentId` | `204` (só desmatricula) | 404 turma ou `"Aluno não encontrado nesta turma."` |
  | `GET /students?page&per_page&search&classroom_id` | `200 Paginated<ApiStudentSummary>` | — |
  | `GET /students/:id` | `200 ApiStudent` | 404 `"Aluno não encontrado."` |
- Rotas do aluno (`@Roles(Student)`, controller `me/classrooms`):
  | Rota | Sucesso | Erros |
  |---|---|---|
  | `GET /me/classrooms` | `200 { data: ApiMyClassroom[] }` | — |
  | `POST /me/classrooms` (`join_code`) | `201 ApiMyClassroom` | 422 `join_code`: `"Código de turma inválido."`, `"Esta turma não está aceitando novos alunos."`, `"Você já está nesta turma."` |
- Busca com o `containsInsensitive` da Task 6.

- [ ] **Step 1: Testes que falham** — professor A cria turma (código `NIV-XXXX` único); professor B: `GET /classrooms/<de A>` → 404, `GET /students/<aluno só de A>` → 404, lista de B não mostra a turma de A; admin vê tudo e cria com `teacher_id`; regenerar troca o código e o antigo deixa de funcionar no cadastro; colisão de código simulada (unit, prisma mock lançando P2002 duas vezes) → terceira tentativa grava; adicionar aluno manualmente cria usuário + perfil + matrícula (e login mobile dele funciona); e-mail duplicado → 422 com a dica; remover aluno da turma; aluno: listar turmas, entrar por código (" niv 4k7q " aceito), repetir → 422 "Você já está nesta turma.", turma inativa → 422; aluno não acessa rotas staff (403).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (e2e, unit, lint, typecheck).
- [ ] **Step 5: Commits** `feat(api): implementa cadastro de turmas com código único` · `feat(api): implementa matrícula manual e remoção de alunos` · `feat(api): implementa listagem e ficha de alunos` · `feat(api): permite ao aluno listar e entrar em turmas` · `feat(contract): adiciona tipos de turma e aluno`

---

### Task 11: Turmas e alunos no painel web

**Branch:** `feature/classrooms` (continuação)

**Files:**
- Create: `apps/web/src/features/classrooms/{api/…,components/JoinCodeCard.tsx,components/ClassroomFormDialog.tsx,components/AddStudentDialog.tsx,pages/ClassroomList/index.tsx,pages/ClassroomDetail/index.tsx,schemas/…,index.ts}`, `apps/web/src/features/students/{api/…,pages/StudentList/index.tsx,pages/StudentDetail/index.tsx,index.ts}`
- Modify: rotas (`/turmas`, `/turmas/:id`, `/alunos`, `/alunos/:id`)
- Test: `ClassroomList.test.tsx`, `ClassroomDetail.test.tsx`, `StudentList.test.tsx`, `StudentDetail.test.tsx`

**Interfaces:**
- Turmas: `DataTable` (nome, ano, código, alunos, professor — só para admin —, status); diálogo de criar/editar (admin escolhe o professor num select alimentado por `GET /teachers?status=active&per_page=100`).
- Detalhe: `JoinCodeCard` — código grande em fonte manuscrita com marca-texto, botão "Copiar código" (Clipboard API; aviso "Código copiado."), "Gerar novo código" com `ConfirmDialog` ("O código antigo deixa de funcionar."); tabela de alunos com "Adicionar aluno" (`AddStudentDialog` com `PasswordField`) e "Remover da turma" (`ConfirmDialog`). Espaço reservado "Desempenho da turma — disponível em breve." (o gráfico vem no Plano 4).
- Alunos: `DataTable` com busca e filtro de turma; ficha com dados, turmas (links), moedas e sequência; espaço reservado para desempenho/planos/extrato (Planos 3 e 4).

- [ ] **Step 1: Testes que falham** — criar turma mostra o código no detalhe; copiar chama `navigator.clipboard.writeText('NIV-…')` e avisa; gerar novo código pede confirmação e atualiza o card; adicionar aluno com e-mail duplicado mostra a dica no campo; remover pede confirmação; admin vê coluna professor e o select no formulário, professor não; 404 da API na ficha mostra estado "não encontrado" com voltar.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (lint, typecheck, test, build).
- [ ] **Step 5: Commits** `feat(web): adiciona cadastro e detalhe de turmas` · `feat(web): adiciona listagem e ficha de alunos`

---

### Task 12: Turmas do aluno no app

**Branch:** `feature/classrooms` (continuação; merge no fim)

**Files:**
- Create: `apps/mobile/src/features/classrooms/{api/classrooms.api.ts,api/classrooms.action.ts,components/MyClassroomsCard.tsx,components/JoinClassroomForm.tsx,schemas/join.schema.ts,index.ts,__tests__/classrooms.test.tsx}`
- Modify: `apps/mobile/src/features/auth/screens/Profile.tsx` (seção "Minhas turmas" + "Entrar em outra turma"), `apps/mobile/src/features/auth/schemas/register.schema.ts` (reusar a normalização do código, sem duplicar)

**Interfaces:**
- Consumes: `GET /me/classrooms`, `POST /me/classrooms` (Task 10), `ApiMyClassroom`.
- Perfil: `PenCard` "Minhas turmas" (nome, ano, professor), estado vazio com o mascote; botão "Entrar em outra turma" abre um campo de código (maiúsculas automáticas, mesma normalização do cadastro) + "Entrar"; erro 422 no campo; sucesso adiciona a turma na lista e mostra "Você entrou na turma <nome>!".

- [ ] **Step 1: Testes que falham** — lista as turmas; vazio mostra mensagem; entrar com " niv 4k7q " envia `NIV-4K7Q`; 422 "Você já está nesta turma." aparece no campo; sucesso adiciona à lista.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (lint, typecheck, test, `npx expo export --platform android`).
- [ ] **Step 5: Commits** `feat(mobile): mostra as turmas do aluno no perfil` · `feat(mobile): permite entrar em outra turma pelo código`

---

### Task 13: Fechamento do plano

**Branch:** `feature/plan2-docs`

**Files:**
- Modify: `docs/estruturaDePastas.md` (tabela de features dos três apps), `docs/architecture.md` (uploads: `UPLOADS_DIR`, `PUBLIC_URL`, `/uploads`; contrato), `README.md` (variáveis novas), `docs/superpowers/plans/2026-11-08-nivela-backlog.md` (marcar o que o Plano 2 resolveu, acrescentar o que sobrar)
- Modify: `.github/workflows/ci.yml` (job de testes do `packages/api-contract`)

- [ ] **Step 1:** Atualizar os docs e o CI.
- [ ] **Step 2: Verificação geral** — `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build` → PASS. Subir API + web e conferir à mão: criar disciplina, categoria, questão com imagem, turma, aluno manual; login do aluno no app (ou via `curl` com `channel: 'mobile'`) e `POST /me/classrooms`.
- [ ] **Step 3: Commits** `docs: atualiza a documentação para os cadastros` · `ci: testa o pacote de contrato`
