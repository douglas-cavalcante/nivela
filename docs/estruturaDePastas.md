# Estrutura de Pastas — Organização por Features

Os três apps do Nivela são organizados **por domínio de negócio (feature)**, no modelo do [bulletproof-react](https://github.com/alan2207/bulletproof-react). Tudo que pertence a um assunto (telas, chamadas à API, tipos, regras) fica junto, dentro da pasta da feature. As features têm os **mesmos nomes** na API, na web e no mobile.

As regras de dependência abaixo são verificadas automaticamente: ESLint na web e no mobile (`npm run lint`) e testes de arquitetura (Pest arch) na API.

---

## Visão geral do monorepo

```
tcc/
├── apps/
│   ├── api/                # Laravel 12 (Composer, fora dos workspaces npm)
│   ├── web/                # React + Vite + TS (professor/admin)
│   └── mobile/             # Expo + Expo Router + TS (aluno)
├── packages/
│   └── design-tokens/      # @nivela/design-tokens (TS puro)
├── docs/                   # arquitetura, estrutura de pastas, workflow, requisitos, UML, prints
├── docker/                 # initdb/ (scripts do Postgres) e pgdata/ (dados locais, ignorado pelo git)
├── docker-compose.yml      # postgres:17-alpine
├── package.json            # npm workspaces: apps/web, apps/mobile, packages/*
└── CLAUDE.md               # índice da documentação
```

## Features

`Auth`, `Users` (professores/admin), `Classrooms`, `Students`, `Subjects`, `Categories`, `Questions`, `Answers`, `LevelingPlans`, `Rewards`, `Dashboard`.

Na API a pasta é `PascalCase` (`Modules/Questions`); na web e no mobile é `camelCase` (`features/questions`, `features/levelingPlans`).

---

## API — `apps/api`

```
app/
├── Modules/
│   └── <Feature>/                 # ex.: Questions
│       ├── Controllers/           # finos: validam via Request, delegam ao Service, devolvem Resource
│       ├── Requests/              # FormRequest (validação + mensagens em pt-BR)
│       ├── Resources/             # formato do JSON de saída
│       ├── Models/
│       ├── Policies/
│       ├── Services/              # regra de negócio, transações
│       └── routes.php             # rotas da feature, carregadas pelo RouteServiceProvider
├── Shared/                        # código usado por mais de uma feature (ex.: CoinLedger, enums)
└── Support/                       # helpers sem regra de negócio
```

**Regras de dependência (Pest arch tests):**

- uma feature não usa classes internas de outra, exceto Models e Services expostos;
- `Shared` e `Support` não dependem de `Modules`;
- controllers não usam `DB::` diretamente (transações ficam nos Services).

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
└── styles/       # Estilos globais
```

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
├── (auth)/                # welcome, login, register
├── (tabs)/                # index, study, store, profile
├── plans/[id].tsx
└── questions/[id].tsx
src/
├── features/<feature>/    # mesma anatomia e mesmas regras de import da web
└── components/ lib/ hooks/ utils/ constants/ types/ assets/
```

---

## Regras de import (web e mobile)

1. Imports que saem da pasta usam o alias `src/...` — nunca `../`. Dentro da mesma pasta, `./` é permitido.
2. Uma feature usa outra **somente** pelo `index.ts` dela.
3. Código compartilhado (`components`, `lib`, `hooks`, `utils`, `constants`, `types`) não importa de `features` nem de `app`.
4. `axios` só pode ser importado em `features/*/api` e em `lib/`.
5. Sem `any` explícito.
6. Nada de cor hexadecimal fora do tema: use sempre os tokens de `@nivela/design-tokens`.

---

## Receitas

### Nova feature

1. **API:** criar `app/Modules/<Feature>/` com `Controllers`, `Requests`, `Resources`, `Models`, `Policies`, `Services` e `routes.php`; registrar o `routes.php`; criar migration e factory; escrever o teste Pest da feature (sucesso, validação, permissão).
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
4. Na API, a rota correspondente vive em `Modules/<Feature>/routes.php` sob o prefixo `/api/v1`.
