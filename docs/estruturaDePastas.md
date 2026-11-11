# Estrutura de Pastas — Organização por Features

Os três apps do Nivela são organizados **por domínio de negócio (feature)**, no modelo do [bulletproof-react](https://github.com/alan2207/bulletproof-react). Tudo que pertence a um assunto (telas, chamadas à API, tipos, regras) fica junto, dentro da pasta da feature. As features têm os **mesmos nomes** na API, na web e no mobile.

As regras de dependência abaixo são verificadas automaticamente: ESLint nos três apps (`npm run lint`).

---

## Visão geral do monorepo

```
tcc/
├── apps/
│   ├── api/                # NestJS 12 + Prisma 7 + TS
│   ├── web/                # React + Vite + TS (professor/admin)
│   └── mobile/             # Expo + Expo Router + TS (aluno)
├── packages/
│   ├── design-tokens/      # @nivela/design-tokens (TS puro)
│   └── api-contract/       # @nivela/api-contract (tipos de resposta e parseApiError, TS puro)
├── docs/                   # arquitetura, estrutura de pastas, workflow, requisitos, UML, prints
├── docker/                 # initdb/ (scripts do Postgres) e pgdata/ (dados locais, ignorado pelo git)
├── docker-compose.yml      # postgres:17-alpine
├── package.json            # npm workspaces: apps/*, packages/*
└── CLAUDE.md               # índice da documentação
```

## Features

`Auth`, `Users` (professores/admin), `Classrooms`, `Students`, `Subjects`, `Categories`, `Questions`, `Answers`, `LevelingPlans`, `Rewards`, `Dashboard`.

Na API e na web a pasta é `kebab-case` (`modules/leveling-plans`, `features/leveling-plans`). No mobile a tela de estudo vive em `features/study` e a do plano em `features/plans` (o aluno enxerga "estudar" e "plano", não "resposta" nem "plano de nivelamento"); as duas consomem os endpoints das features `answers` e `leveling-plans` da API.

### Situação das features

| Feature | API (`modules/`) | Web (`features/`) | Mobile (`features/`) |
|---|---|---|---|
| `auth` | login, cadastro do aluno com código de turma, perfil e troca de senha | Login, Perfil | Welcome, Login, Register, Perfil |
| `teachers` | CRUD de professores, ativar/desativar, redefinir senha (admin) | Lista de professores (admin) | — |
| `subjects` | CRUD de disciplinas (cor e ícone dos tokens) | Lista de disciplinas | — |
| `categories` | CRUD de categorias por disciplina | Lista de categorias | — |
| `questions` | CRUD de questões, alternativas, imagem, ativar/desativar (RN02) | Lista e formulário de questão (com upload de imagem) | — |
| `classrooms` | CRUD de turmas, código de entrada, matrícula manual e remoção de alunos; `GET`/`POST /me/classrooms` do aluno | Lista e ficha da turma | "Minhas turmas" e entrada pelo código no Perfil |
| `students` | Listagem e ficha de alunos (escopo do professor) | Lista e ficha do aluno | — |
| `health` | `GET /health` | — | — |
| `answers` | prática livre (`GET /practice/subjects`, `GET /practice/next`), próxima questão do capítulo (`GET /me/plans/:id/chapters/:chapterId/next`), respostas com tentativas, moedas e sequência (`POST /answers`), `GET /me/stats` | — (o professor vê o desempenho no Plano 4) | `study` (`features/study`): Estudar (prática por disciplina), tela de questão e feedback, barra de moedas/sequência |
| `leveling-plans` | CRUD de planos, capítulos ordenáveis, questões do capítulo, publicar, atribuições a turma/aluno com prazo, progresso; `GET /me/plans`, `GET /me/plans/:id`, `GET /students/:id/plans` | `leveling-plans`: lista e editor de planos (capítulos, seletor de questões, atribuições, progresso) | `plans` (`features/plans`): Meus planos no Início, tela do plano com capítulos (cadeado/progresso) e estudo do capítulo |
| `rewards`, `dashboard` | planejadas (Plano 4) | planejadas | planejadas |

---

## API — `apps/api`

```
src/
├── modules/
│   └── <feature>/                 # ex.: questions/
│       ├── dto/                   # class-validator (mensagens em pt-BR)
│       ├── <feature>.controller.ts    # fino: valida via DTO, delega ao service
│       ├── <feature>.service.ts       # regra de negócio, transações Prisma
│       ├── <feature>.service.spec.ts  # unitário com Prisma mockado
│       └── <feature>.module.ts        # `exports` define o que outras features podem usar
├── common/                        # filters, pipes, guards (AuthGuard, RolesGuard), decorators (@Public, @Roles, @AnyAuthenticated, @CurrentUser), validators (sem regra de negócio)
├── shared/                        # enums, exceções, contrato de autenticação (auth/auth-user.ts), relógio injetável (clock/: `CLOCK` + `ClockModule`), moedas (coins/: `CoinLedger` e `coin-rules.ts`), dia de estudo e sequência (study/: `studyDay`, `StreakService`, `StudyModule`), escopos de leitura (scopes/), paginação (pagination/), helpers do Prisma (prisma/, ex.: `isUniqueViolation`) e regras usadas por mais de uma feature
├── prisma/                        # PrismaModule (global) e PrismaService (adapter-pg)
├── generated/prisma/              # client do Prisma (gerado, ignorado pelo git)
├── app.factory.ts                 # configureApp(): prefixo, validação, filtro, CORS, Swagger
├── app.module.ts
└── main.ts
prisma/schema.prisma, prisma/migrations/, prisma/seed.ts   # seed: administrador inicial a partir de ADMIN_*
test/*.e2e-spec.ts                 # e2e com supertest contra o banco nivela_test
test/helpers/                      # createTestApp(), resetDatabase(), factories (createUser/createClassroom) e rotas só de teste
scripts/test-db-migrate.js           # aplica as migrations no banco nivela_test antes do e2e
```

**Como `answers` e `leveling-plans` se dividem:** `answers` registra a resposta (`AnswersService`) e serve a prática livre; `leveling-plans` cuida do plano, dos capítulos, das atribuições, do progresso e do estado dos capítulos do aluno (`StudentPlansService`, exportado). A resposta com `plan_chapter_id` chama o `StudentPlansService` (a dependência vai só de `answers` para `leveling-plans`, pelo service exportado). `CoinLedger` e `StreakService` ficam em `shared/` porque `answers` os usa hoje e a loja (Plano 4) os usará amanhã.

**Escopos de leitura (`src/shared/scopes/`):** `classroomScope(user)`, `studentScope(user)`, `planScope(user)` (planos do professor; admin vê todos) e `studentPlanScope(studentId)` (o plano visível a um aluno: publicado e atribuído a ele ou a uma turma em que está matriculado; único filtro das rotas do aluno que leem plano, capítulo ou questão de capítulo). Consultas partem sempre de um escopo.

**Regras de dependência (ESLint, `apps/api/eslint.config.mjs`):**

- imports que saem da pasta usam o alias `src/...` — nunca `../`;
- uma feature não importa arquivos internos de outra: usa só `src/modules/<outra>/<outra>.module` ou os services exportados por ela (`src/modules/<outra>/*.service`, ex.: `classrooms/join-code.service`); controllers, DTOs e demais arquivos continuam privados da feature;
- `common`, `shared` e `prisma` não importam de `src/modules`;
- `*.controller.ts` não importa o `PrismaService` (acesso a dados fica no service);
- `@typescript-eslint/no-explicit-any` como erro.

---

## Web — `apps/web`

```
src/
├── app/          # App.tsx, rotas, layouts (AppLayout com sidebar "fichário", AuthLayout)
├── features/     # Um diretório por feature
├── components/   # UI genérica, sem regra de negócio, uma pasta por componente (DataTable, FormDialog, ConfirmDialog, SearchField, AsyncAutocomplete (busca no servidor, substitui selects que cortavam em 100 itens), StatusChip, PasswordField, ErrorBoundary, EmptyState, ResourceState, Mascot, PageHeader)
├── lib/          # Adaptadores: axios (interceptor de token e 401), AuthContext, notify (avisos rápidos), theme (MUI a partir dos design tokens)
├── hooks/        # Hooks genéricos de lista: useListQuery (filtros na URL), usePaginatedList, useRemoteList
├── utils/        # Funções puras
├── constants/    # Constantes globais
├── types/        # Tipos usados por várias features
├── assets/       # Imagens e arquivos compartilhados
├── styles/       # Estilos globais
└── test/         # Infra dos testes: setup (jest-dom, MSW), server MSW, renderWithProviders, usuários de exemplo
```

**`leveling-plans` (web):** `pages/PlanList` e `pages/PlanEditor` (abas Capítulos, Atribuições e Progresso), `components/` (`QuestionPicker`, `ChapterCard`, `ChapterFormDialog`, `AssignDialog`, `ProgressTable`…) e `schemas/`. Usa `questions`, `classrooms` e `students` só pelos `index.ts` delas.

O ESLint da web (`apps/web/eslint.config.mjs`) lê `src/features/*` para montar as regras de cada feature; `src/lib/theme` é o único lugar de `src/` onde cor hexadecimal é permitida (o tema MUI gerado a partir dos tokens).

**Direção das dependências:** `app → features → (components, lib, hooks, utils, constants, types)`. Nunca no sentido contrário.

**Filtros de listagem (web):** o estado da lista fica na URL (`useListQuery`). Ao montar os params da API, **filtro vazio (`''`) é omitido** (nunca vai `?subject_id=`; a API também trata parâmetro vazio como ausente, mas o cliente não depende disso). Um select de filtro cujo padrão não é vazio (ex.: situação = ativos) precisa de uma opção **"Todos"/"Todas" com valor `''`**, senão a pessoa não consegue voltar a ver tudo.

### Anatomia de uma feature (web)

Cada feature usa só as subpastas de que precisa:

```
features/questions/
├── api/          # <recurso>.api.ts (retorna a resposta do axios) e <recurso>.action.ts (retorna só o data)
├── components/   # Componentes usados por mais de uma tela da feature
├── schemas/      # Validações (zod) compartilhadas entre telas
├── types/
├── utils/
├── pages/        # Uma pasta por tela (componente de rota)
│   └── QuestionList/
│       ├── index.tsx             # a tela
│       ├── QuestionFilters.tsx   # arquivos usados só por esta tela ficam aqui
│       └── QuestionList.test.tsx # teste da tela, ao lado dela
└── index.ts      # API pública: o que outras features podem usar
```

Tipos, constantes e utils ficam **o mais perto possível de quem usa**; só sobem de nível quando passam a ser usados por mais de um consumidor.

---

## Mobile — `apps/mobile`

```
app/                       # Rotas (Expo Router) — só montam a tela, sem lógica
├── _layout.tsx            # fontes, ThemeProvider, AuthProvider e Stack.Protected (grupos (tabs) e (auth))
├── (auth)/                # welcome, login, register
├── (tabs)/                # index, study, store, profile (barra de abas: Início, Estudar, Loja, Perfil)
├── plans/[id].tsx         # tela do plano (capítulos)
├── plans/[id]/chapters/[chapterId].tsx   # estudo de um capítulo (questão + feedback)
└── practice/[subjectId].tsx              # prática livre de uma disciplina
src/
├── features/<feature>/    # mesmas regras de import da web; anatomia abaixo
├── components/            # arquivos soltos, um por componente (AppText.tsx, Button.tsx…): AppText, Button, EmptyState, HandTitle, Mascot, OfflineScreen, PaperBackground (fundo pautado), PenCard (borda + sombra sólida), TabIcon, TextField
├── lib/                   # axios (Bearer e 401), auth (AuthContext, tokenStorage via expo-secure-store), theme (ThemeProvider/useTheme a partir dos design tokens)
├── types/ hooks/ utils/ constants/ assets/
└── test/                  # setup do Jest (SecureStore em memória), renderApp (renderRouter) e usuários de exemplo
```

### Anatomia de uma feature (mobile)

Mesmas subpastas da web, mas cada tela é **um arquivo** em `screens/` (não uma pasta em `pages/`), e os testes da feature ficam juntos em `__tests__/`. Features de estudo também usam `hooks/` (ex.: `useQuestionRound`, a rodada de uma questão compartilhada pela prática e pelo capítulo):

```
features/auth/
├── api/          # auth.api.ts e auth.action.ts
├── components/   # AuthForm, FormTextField (usados por mais de uma tela)
├── schemas/      # login.schema.ts, register.schema.ts (zod)
├── types/
├── screens/      # Uma tela por arquivo: Login.tsx, Register.tsx, Profile.tsx, Welcome.tsx
├── __tests__/    # login.test.tsx, register.test.tsx, register.schema.test.ts…
└── index.ts      # API pública: as telas que as rotas de app/ montam
```

- **`study` e `plans`:** `plans` usa `study` pelo `index.ts` (`QuestionView`, `FeedbackView`, `StatsBar`, `CoinBurst`, `useQuestionRound`); `study` nunca importa de `plans`. As duas telas de questão (prática e capítulo) são finas e só diferem na origem da próxima questão e no `plan_chapter_id` enviado.
- **Dados remotos:** telas do aluno leem pelo hook `useRemote` (`src/hooks`: cancelamento, resposta atrasada descartada, `reload`) e recarregam ao voltar à tela (`useReloadOnFocus`), para moedas, sequência e contagens não ficarem velhas.
- **Rotas protegidas:** `app/_layout.tsx` usa `Stack.Protected` — o grupo `(tabs)` só existe com usuário logado e `(auth)` só sem usuário; o redirecionamento acontece sozinho quando o login muda (inclusive no 401 que expira a sessão).
- **Sem conexão:** na abertura, se há token salvo e o `GET /auth/me` falha por rede, tempo esgotado (15 s) ou 5xx, o token é mantido e `app/_layout.tsx` mostra a `OfflineScreen` ("Sem conexão com o servidor." + "Tentar de novo"); só o 401 encerra a sessão.
- **Testes** ficam em `__tests__/` ao lado do código (`app/(tabs)/__tests__`, `src/lib/__tests__`); o Metro não os inclui no bundle.
- O ESLint do mobile (`apps/mobile/eslint.config.mjs`) tem as mesmas regras da web; `app/` conta como camada de rotas (`src/` nunca importa de `app/`) e `src/lib/theme` é o único lugar com cor hexadecimal permitida.
- Diferença em relação à web: o `tokenStorage` é assíncrono (`expo-secure-store`), então `signIn` retorna `Promise<void>`.

---

## Regras de import (web e mobile)

1. Imports que saem da pasta usam o alias `src/...` — nunca `../`. Dentro da mesma pasta, `./` é permitido.
2. Uma feature usa outra **somente** pelo `index.ts` dela.
3. Código compartilhado (`components`, `lib`, `hooks`, `utils`, `constants`, `types`) não importa de `features` nem de `app`.
4. `axios` só pode ser importado em `features/*/api` e em `lib/`.
5. Sem `any` explícito.
6. Nada de cor hexadecimal fora do tema: use sempre os tokens de `@nivela/design-tokens`.
7. Tipos de resposta da API (usuário, paginação, corpo de erro, turma, questão…) e o `parseApiError` vêm de `@nivela/api-contract`: nunca redefina-os em `types/` do app. Na API, importe do contrato somente com `import type`. Ao criar ou mudar uma rota, atualize o tipo de resposta no contrato (um arquivo por feature em `packages/api-contract/src/`) e exporte-o no `index.ts`.

---

## Textos e mensagens

- Interface e mensagens da API em português do Brasil, sempre **frases completas terminadas em ponto** — **toda frase visível**, inclusive títulos de estado vazio/erro (`EmptyState`, `emptyTitle` da `DataTable`, tela de sem conexão), descrições e dicas de campo: `Nenhuma categoria por aqui.`, `Nenhum aluno nesta turma ainda.`, `Nenhuma turma ainda.`, `Não deu para carregar.`, `Em breve.`, `Peça ao seu professor. Ex.: NIV-4K7Q.`. Ficam de fora só rótulos curtos que não são frases: títulos de página e de diálogo, cabeçalhos de seção/card, rótulos de campo, botões, links, abas e dicas de ícone (`Turmas`, `Adicionar aluno`, `Tentar de novo`).
- Campo vazio: **"Informe …"** (`Informe seu e-mail.`, `Informe sua senha.`, `Informe seu nome.`, `Informe o código da turma.`, `Informe sua senha atual.`); confirmação vazia: `Confirme sua senha.` / `Confirme a nova senha.`.
- A mesma regra usa **o mesmo texto** na API, na web e no mobile: `A senha deve ter pelo menos 8 caracteres.`, `A confirmação de senha não confere.`, `Informe um e-mail válido.`.
- Na API, cada campo devolve as mensagens sem repetição (`@IsString` e `@IsNotEmpty` podem usar a mesma frase).

---

## Receitas

### Nova feature

1. **API:** criar `src/modules/<feature>/` com `dto/`, controller, service e module; importar o module no `AppModule`; adicionar os models no `prisma/schema.prisma` e gerar a migration (`npm run db:migrate -w apps/api`); escrever o teste e2e da feature (sucesso, validação, permissão) e os unitários do service.
   - **Busca parcial:** use sempre `containsInsensitive(term)` (`src/shared/prisma/contains-insensitive.ts`) em vez de `{ contains, mode: 'insensitive' }` direto — o Prisma repassa `%`, `_` e `\` ao `ILIKE` sem escapar, e o helper os trata como texto literal.
   - **Escopo do professor:** consultas de turmas e alunos partem de `classroomScope(user)` / `studentScope(user)` (`src/shared/scopes/`), também nas escritas; recurso fora do escopo responde 404.
   - **Autorização negada por padrão:** toda rota precisa declarar quem pode acessá-la — `@Roles(Role.Admin, …)` (no método ou no controller), `@AnyAuthenticated()` (qualquer usuário logado) ou `@Public()`. Sem nenhum deles, o `RolesGuard` responde 403, e o teste `test/route-authorization.e2e-spec.ts` falha apontando a rota esquecida.
2. **Web/Mobile:** criar `src/features/<feature>/` com `api/`, `pages/` (web) ou `screens/` (mobile) e `index.ts`; exportar no `index.ts` só o que outras features (e, no mobile, as rotas de `app/`) precisam.
3. Rodar `npm run lint` e `npm run test`; atualizar esta página se a estrutura mudou.

### Nova tela

1. **Web:** criar `features/<feature>/pages/<NomeDaTela>/index.tsx` (subcomponentes só dessa tela ficam na mesma pasta) e registrar a rota em `src/app/routes`.
2. **Mobile:** criar `features/<feature>/screens/<NomeDaTela>.tsx`, exportá-la no `index.ts` da feature e criar o arquivo da rota em `app/` que só reexporta a tela (ex.: `app/(auth)/login.tsx` → `export default Login`).
3. Textos de interface em português do Brasil; cores só via tema.

### Nova chamada à API

1. Em `features/<feature>/api/<recurso>.api.ts`, criar a função com axios (retorna a resposta completa).
2. Em `<recurso>.action.ts`, criar a função que chama a `.api.ts` e devolve só o `data` tipado.
3. As telas usam a `.action.ts`; os tipos de resposta ficam em `types/`.
4. Na API, a rota correspondente vive no controller da feature (`modules/<feature>/<feature>.controller.ts`), sob o prefixo global `/api/v1`.
