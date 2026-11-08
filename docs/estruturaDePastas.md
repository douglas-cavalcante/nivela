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
│   └── design-tokens/      # @nivela/design-tokens (TS puro)
├── docs/                   # arquitetura, estrutura de pastas, workflow, requisitos, UML, prints
├── docker/                 # initdb/ (scripts do Postgres) e pgdata/ (dados locais, ignorado pelo git)
├── docker-compose.yml      # postgres:17-alpine
├── package.json            # npm workspaces: apps/*, packages/*
└── CLAUDE.md               # índice da documentação
```

## Features

`Auth`, `Users` (professores/admin), `Classrooms`, `Students`, `Subjects`, `Categories`, `Questions`, `Answers`, `LevelingPlans`, `Rewards`, `Dashboard`.

Na API a pasta é `kebab-case` (`modules/leveling-plans`); na web e no mobile é `camelCase` (`features/questions`, `features/levelingPlans`).

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
├── shared/                        # enums, exceções, contrato de autenticação (auth/auth-user.ts), relógio injetável (clock/), paginação (pagination/), helpers do Prisma (prisma/, ex.: `isUniqueViolation`) e regras usadas por mais de uma feature
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
├── components/   # UI genérica, sem regra de negócio (PageHeader, DataTable, ConfirmDialog, EmptyState…)
├── lib/          # Adaptadores: axios (interceptor de token e 401), AuthContext, theme (MUI a partir dos design tokens)
├── hooks/        # Hooks genéricos
├── utils/        # Funções puras
├── constants/    # Constantes globais
├── types/        # Tipos usados por várias features
├── assets/       # Imagens e arquivos compartilhados
├── styles/       # Estilos globais
└── test/         # Infra dos testes: setup (jest-dom, MSW), server MSW, renderWithProviders, usuários de exemplo
```

O ESLint da web (`apps/web/eslint.config.mjs`) lê `src/features/*` para montar as regras de cada feature; `src/lib/theme` é o único lugar de `src/` onde cor hexadecimal é permitida (o tema MUI gerado a partir dos tokens).

**Direção das dependências:** `app → features → (components, lib, hooks, utils, constants, types)`. Nunca no sentido contrário.

### Anatomia de uma feature (web e mobile)

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
│       └── QuestionFilters.tsx   # arquivos usados só por esta tela ficam aqui
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
├── plans/[id].tsx
└── questions/[id].tsx
src/
├── features/<feature>/    # mesma anatomia e mesmas regras de import da web
├── components/            # AppText, Button, EmptyState, HandTitle, Mascot, OfflineScreen, PaperBackground (fundo pautado), PenCard (borda + sombra sólida), TabIcon, TextField
├── lib/                   # axios (Bearer e 401), auth (AuthContext, tokenStorage via expo-secure-store), theme (ThemeProvider/useTheme a partir dos design tokens)
├── types/ hooks/ utils/ constants/ assets/
└── test/                  # setup do Jest (SecureStore em memória), renderApp (renderRouter) e usuários de exemplo
```

- **Rotas protegidas:** `app/_layout.tsx` usa `Stack.Protected` — o grupo `(tabs)` só existe com usuário logado e `(auth)` só sem usuário; o redirecionamento acontece sozinho quando o login muda (inclusive no 401 que expira a sessão).
- **Sem conexão:** na abertura, se há token salvo e o `GET /auth/me` falha por rede, tempo esgotado (15 s) ou 5xx, o token é mantido e `app/_layout.tsx` mostra a `OfflineScreen` ("Sem conexão com o servidor" + "Tentar de novo"); só o 401 encerra a sessão.
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

---

## Textos e mensagens

- Interface e mensagens da API em português do Brasil, sempre **frases completas terminadas em ponto**.
- Campo vazio: **"Informe …"** (`Informe seu e-mail.`, `Informe sua senha.`, `Informe seu nome.`, `Informe o código da turma.`, `Informe sua senha atual.`); confirmação vazia: `Confirme sua senha.` / `Confirme a nova senha.`.
- A mesma regra usa **o mesmo texto** na API, na web e no mobile: `A senha deve ter pelo menos 8 caracteres.`, `A confirmação de senha não confere.`, `Informe um e-mail válido.`.
- Na API, cada campo devolve as mensagens sem repetição (`@IsString` e `@IsNotEmpty` podem usar a mesma frase).

---

## Receitas

### Nova feature

1. **API:** criar `src/modules/<feature>/` com `dto/`, controller, service e module; importar o module no `AppModule`; adicionar os models no `prisma/schema.prisma` e gerar a migration (`npm run db:migrate -w apps/api`); escrever o teste e2e da feature (sucesso, validação, permissão) e os unitários do service.
   - **Autorização negada por padrão:** toda rota precisa declarar quem pode acessá-la — `@Roles(Role.Admin, …)` (no método ou no controller), `@AnyAuthenticated()` (qualquer usuário logado) ou `@Public()`. Sem nenhum deles, o `RolesGuard` responde 403, e o teste `test/route-authorization.e2e-spec.ts` falha apontando a rota esquecida.
2. **Web/Mobile:** criar `src/features/<feature>/` com `api/`, `pages/` e `index.ts`; exportar no `index.ts` só o que outras features precisam.
3. Rodar `npm run lint` e `npm run test`; atualizar esta página se a estrutura mudou.

### Nova tela

1. Criar `features/<feature>/pages/<NomeDaTela>/index.tsx`; subcomponentes só dessa tela ficam na mesma pasta.
2. Web: registrar a rota em `src/app`. Mobile: criar o arquivo correspondente em `app/` que apenas renderiza a tela.
3. Textos de interface em português do Brasil; cores só via tema.

### Nova chamada à API

1. Em `features/<feature>/api/<recurso>.api.ts`, criar a função com axios (retorna a resposta completa).
2. Em `<recurso>.action.ts`, criar a função que chama a `.api.ts` e devolve só o `data` tipado.
3. As telas usam a `.action.ts`; os tipos de resposta ficam em `types/`.
4. Na API, a rota correspondente vive no controller da feature (`modules/<feature>/<feature>.controller.ts`), sob o prefixo global `/api/v1`.
