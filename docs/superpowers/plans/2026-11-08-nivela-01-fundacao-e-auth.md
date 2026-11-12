# Nivela — Plano 1: Fundação e Autenticação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo funcionando com API NestJS, painel web e app Expo integrados, identidade "Caderno Vivo" aplicada e login/cadastro de ponta a ponta para os três perfis.

**Architecture:** npm workspaces (`apps/*`, `packages/*`). Web e mobile consomem `@nivela/design-tokens` (TS puro, sem build). API REST `/api/v1` com token Bearer opaco (hash em `access_tokens`); código por feature em `src/modules/<feature>`, no modelo do backend do Estagius.

> **Revisão 2 (2026-11-08):** o usuário trocou o backend de Laravel 12 para **NestJS 12 + Prisma 7**. Tasks 1 e 2 já estavam concluídas; as Tasks 3, 6 e 9 e as Global Constraints foram reescritas. A Task 3 também atualiza os docs/README/package.json criados na Task 1.

**Tech Stack:** NestJS 12 (Node 22, TypeScript ~6.0), Prisma 7 + `@prisma/adapter-pg`, class-validator, bcryptjs, Jest + supertest, Swagger, PostgreSQL 17 (Docker) · React 19 + Vite 8 + TS + MUI 9 + React Router 8 + Axios + react-hook-form + zod + Vitest + MSW · Expo SDK 58 + Expo Router + expo-secure-store + react-native-svg + jest-expo.

**Spec:** `docs/superpowers/specs/2026-11-08-nivela-design.md`

## Roteiro dos planos

Este é o plano 1 de 5. Cada plano seguinte é escrito **depois** que o anterior estiver integrado em `develop`, sobre o código real.

| Plano | Branches | Entrega |
|---|---|---|
| **1 — Fundação e autenticação** (este) | `feature/monorepo-setup`, `feature/design-tokens`, `feature/api-foundation`, `feature/web-foundation`, `feature/mobile-foundation`, `feature/auth`, `feature/ci` | apps sobem, login/cadastro funcionam, CI verde |
| 2 — Cadastros | `feature/teachers`, `feature/subjects-categories`, `feature/questions`, `feature/classrooms` | painel gerencia professores, disciplinas, categorias, questões, turmas e alunos |
| 3 — Estudo | `feature/answers`, `feature/leveling-plans` | aluno responde com feedback, moedas e sequência; planos em capítulos |
| 4 — Gamificação e relatórios | `feature/rewards-store`, `feature/dashboard-reports` | loja e resgates; dashboard e desempenho por categoria |
| 5 — Entrega | `feature/seed-demo`, `feature/tcc-docs`, `release/1.0.0` | dados de demonstração, UML e prints, tag `v1.0.0` |

## Global Constraints

- Ambiente: Windows 11, comandos em Git Bash; Node 22, npm 10. **Docker Desktop precisa estar aberto** antes da Task 1.
- API: NestJS `^12`, Prisma `^7` (não usar o 8, ainda em RC), TypeScript `~6.0` **só no workspace da API** (a CLI do Nest 12 exige; web, mobile e tokens podem usar o TS 7). Testes da API com Jest (+ supertest no e2e).
- Banco: `postgres:17-alpine`, porta host **5433**, usuário/senha `nivela`/`nivela`, bancos `nivela` e `nivela_test`.
- API em `http://localhost:8000/api/v1` (`npm run start:dev -w apps/api`, escutando em `0.0.0.0:8000`).
- TypeScript estrito; sem `any` explícito; imports que saem da pasta usam alias `src/`.
- Cores só via tokens/tema — nenhum hex fora de `packages/design-tokens`.
- Textos de interface e mensagens de erro da API em **português do Brasil**.
- Commits: Conventional Commits em português com escopo (`feat(api): …`), pequenos, cada um terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. O repositório já está configurado para assinar (SSH) como `Henrique Douglas <henriquedouglas2803@gmail.com>` — **não** alterar `git config`.
- Gitflow: cada branch sai de `develop` atualizado e volta com `git merge --no-ff`, depois `git branch -d`. Nada de push sem autorização do usuário.
- Referência de padrões: `C:\Users\Windows 10 Pro\Documents\Estagius Migrado` (`estagius novo/eslint.config.mjs`, `estagius novo/wiki/estruturaDePastas.md`, `backend_estagius_nest/docs/`). Só leitura.

## Review Focus

1. **E-mail com maiúsculas/espaços** (`" Ana@Escola.com "`) no cadastro e no login → normalizado (trim + minúsculas); login funciona. Teste na Task 6.
2. **Código de turma digitado em minúsculas ou com espaços** (`" niv-4k7q "`) → aceito. Teste na Task 6.
3. **Token expirado/revogado** em web e mobile → resposta 401 limpa o token e leva ao login uma única vez (sem loop de redirecionamento). Testes nas Tasks 4 e 5.
4. **E-mail já cadastrado** no cadastro do aluno → 422 com `errors.email = ["Este e-mail já está cadastrado."]`. Teste na Task 6.
5. **Código de turma inativa** → 422 com `errors.join_code = ["Esta turma não está aceitando novos alunos."]`. Teste na Task 6.

---

### Task 1: Monorepo, Docker e documentação base

**Branch:** `feature/monorepo-setup`

**Files:**
- Create: `package.json`, `.editorconfig`, `.nvmrc` (`22`), `docker-compose.yml`, `docker/initdb/01-create-test-db.sql`, `CLAUDE.md`, `docs/estruturaDePastas.md`, `docs/architecture.md`, `docs/workflow.md`
- Modify: `README.md`

**Interfaces:**
- Produces: scripts raiz `db:up` (`docker compose up -d`), `db:down`, `dev:api` (`cd apps/api && php artisan serve --host=0.0.0.0 --port=8000`), `dev:web` (`npm run dev -w apps/web`), `dev:mobile` (`npm run start -w apps/mobile`), `lint` (`npm run lint --workspaces --if-present`), `test` (`npm run test --workspaces --if-present`); `workspaces: ["apps/web", "apps/mobile", "packages/*"]`; `"private": true`, `"name": "nivela"`.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/monorepo-setup`
- [ ] **Step 2:** Criar `docker-compose.yml` (serviço `postgres`, `container_name: nivela_db`, imagem `postgres:17-alpine`, env `POSTGRES_USER/PASSWORD/DB = nivela`, porta `5433:5432`, volume `./docker/pgdata`, montagem `./docker/initdb:/docker-entrypoint-initdb.d:ro`, healthcheck `pg_isready`) e `docker/initdb/01-create-test-db.sql` com `CREATE DATABASE nivela_test OWNER nivela;`.
- [ ] **Step 3: Verificar o banco**
  Run: `docker compose up -d && sleep 8 && docker exec nivela_db psql -U nivela -lqt | cut -d'|' -f1 | grep -w nivela`
  Expected: aparecem `nivela` e `nivela_test`.
- [ ] **Step 4:** Criar `package.json` raiz com os scripts acima e `.editorconfig` (utf-8, lf, 2 espaços; 4 para `*.php`).
- [ ] **Step 5:** Escrever a documentação, adaptando o modelo do Estagius ao Nivela:
  - `docs/estruturaDePastas.md`: estrutura por feature nos três apps (spec §3.2–3.4), regras de import, lista de features, receitas "nova feature/nova tela/nova chamada à API".
  - `docs/architecture.md`: stack com versões e motivo (Laravel 12 por PHP 8.2), diagrama da spec §3, como subir o ambiente.
  - `docs/workflow.md`: gitflow da spec §10, padrão de commits, definição de pronto (spec §9).
  - `CLAUDE.md`: índice apontando para os três docs e para a spec, no formato do `CLAUDE.md` do Estagius.
  - `README.md`: o que é o Nivela, pré-requisitos, passo a passo `npm run db:up` → API → web → mobile.
- [ ] **Step 6: Commit (um por assunto)**
  `chore: adiciona docker compose com postgres 17` · `chore: configura npm workspaces do monorepo` · `docs: documenta arquitetura, estrutura de pastas e workflow`
- [ ] **Step 7:** `git checkout develop && git merge --no-ff feature/monorepo-setup && git branch -d feature/monorepo-setup`

---

### Task 2: Design tokens "Caderno Vivo"

**Branch:** `feature/design-tokens`

**Files:**
- Create: `packages/design-tokens/package.json` (`"name": "@nivela/design-tokens"`, `"main": "src/index.ts"`, `"types": "src/index.ts"`, script `test: vitest run`), `tsconfig.json`, `src/index.ts`, `src/colors.ts`, `src/typography.ts`, `src/layout.ts`, `src/contrast.ts`, `src/mascot.ts`
- Test: `packages/design-tokens/src/__tests__/contrast.test.ts`, `src/__tests__/themes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ThemeMode = 'light' | 'dark';
  export interface ThemeColors {
    background: string; surface: string; rule: string;        // papel, cartão, pauta
    text: string; textMuted: string; border: string; shadow: string;
    primary: string; onPrimary: string;                         // ação principal (turquesa)
    secondary: string; onSecondary: string;                     // coral
    highlight: string; onHighlight: string;                     // marca-texto
    danger: string; onDanger: string; success: string; onSuccess: string;
  }
  export const brand: { ink: '#23313F'; teal: '#1FB5A6'; tealDark: '#0E7C72'; coral: '#FF7A59'; highlighter: '#FFD86B'; paper: '#FFFDF6'; rule: '#E6EEF5'; muted: '#5B6B7A' };
  export const themes: Record<ThemeMode, ThemeColors>;
  export const fonts: { heading: 'Caveat'; body: 'Nunito' };
  export const radius: { sm: 8; md: 12; lg: 16; pill: 999 };
  export const spacing: (n: number) => number;                  // n * 4
  export const penShadow: { offset: 3; width: 2 };              // borda 2px + sombra sólida 3px 3px
  export function contrastRatio(foreground: string, background: string): number;   // WCAG 2.1
  export const mascot: { viewBox: '0 0 64 64'; shapes: Array<{ d: string; fill: keyof typeof brand | 'none'; stroke?: keyof typeof brand }> };
  ```
- Valores fixos do tema claro: `background=paper`, `surface=#FFFFFF`, `rule=#E6EEF5`, `text=ink`, `textMuted=#5B6B7A`, `border=ink`, `shadow=ink`, `primary=#0E7C72`/`onPrimary=#FFFFFF`, `secondary=coral`/`onSecondary=ink`, `highlight=highlighter`/`onHighlight=ink`, `danger=#B42318`/`onDanger=#FFFFFF`, `success=#15803D`/`onSuccess=#FFFFFF`. Tema escuro ("papel noturno"): fundo azul-tinta escuro, pauta sutil, destaques turquesa/coral/marca-texto — valores livres desde que passem no teste de contraste.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/design-tokens`; instalar `vitest` e `typescript` como devDependencies do pacote (`npm i -D vitest typescript -w packages/design-tokens`).
- [ ] **Step 2: Testes que falham**
  ```ts
  // contrast.test.ts
  it('calcula contraste WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#23313F', '#FFFDF6')).toBeGreaterThan(12);
  });
  // themes.test.ts
  const pairs = [['text','background'],['text','surface'],['textMuted','surface'],['onPrimary','primary'],
    ['onSecondary','secondary'],['onHighlight','highlight'],['onDanger','danger'],['onSuccess','success']] as const;
  it.each(['light','dark'] as const)('tema %s respeita WCAG AA (≥ 4.5)', (mode) => {
    for (const [fg, bg] of pairs) expect(contrastRatio(themes[mode][fg], themes[mode][bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('mascote referencia só cores da marca', () => {
    for (const s of mascot.shapes) expect(s.fill === 'none' || s.fill in brand).toBe(true);
  });
  ```
- [ ] **Step 3:** Run `npm test -w packages/design-tokens` → FAIL (módulos inexistentes).
- [ ] **Step 4:** Implementar os arquivos com as interfaces acima. `contrastRatio` usa luminância relativa sRGB (WCAG 2.1). Mascote "Rabisco": lápis original na diagonal — corpo `highlighter` com contorno `ink`, ponta de madeira e grafite `ink`, borracha `coral`, dois olhos e um sorriso `ink`.
- [ ] **Step 5:** Run `npm test -w packages/design-tokens` → PASS.
- [ ] **Step 6: Commits** `feat(tokens): cria paleta e temas claro e escuro do Caderno Vivo` · `feat(tokens): adiciona mascote Rabisco em SVG` · `test(tokens): garante contraste WCAG AA dos temas`
- [ ] **Step 7:** merge `--no-ff` em `develop` e apagar a branch.

---

### Task 3: Fundação da API (NestJS)

**Branch:** `feature/api-foundation`

**Files:**
- Create: `apps/api/` via `npx @nestjs/cli@12 new api --directory apps/api --package-manager npm --skip-git --strict` (depois ajustar `package.json`: `"name": "@nivela/api"`, `"private": true`; remover o `package-lock.json` interno — o lock é o da raiz)
- Create: `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`, `prisma/schema.prisma` (só `datasource`/`generator` nesta task), `prisma.config.ts` (se exigido pelo Prisma 7), `src/common/filters/http-exception.filter.ts`, `src/common/pipes/validation.pipe.ts` (factory), `src/common/decorators/public.decorator.ts`, `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`, `src/shared/enums/role.enum.ts`, `src/shared/exceptions/business-rule.exception.ts`, `src/modules/health/health.controller.ts`, `src/modules/health/health.module.ts`, `src/app.module.ts`, `src/main.ts`, `src/app.factory.ts`, `.env.example`, `.env.test`, `test/jest-e2e.json`, `test/helpers/create-test-app.ts`, `scripts/test-db-reset.js`
- Modify (docs da Task 1, que ainda falam de Laravel): `package.json` raiz (`workspaces: ["apps/*", "packages/*"]`, `dev:api` → `npm run start:dev -w apps/api`, `description`), `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/estruturaDePastas.md`, `docs/workflow.md` — tudo conforme a spec §3.2 revisada (NestJS 12, Prisma 7, token opaco, Jest, Swagger, regras de import por ESLint). Aproveitar e registrar em `docs/workflow.md` que todo commit termina com o trailer `Co-Authored-By` (minor deferido da Task 1).
- Test: `src/modules/health/health.controller.spec.ts`, `test/health.e2e-spec.ts`, `test/errors.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `src/app.factory.ts`: `configureApp(app: INestApplication): INestApplication` — aplica `setGlobalPrefix('api/v1')`, `ValidationPipe` global (whitelist, transform, `exceptionFactory` → 422), `HttpExceptionFilter` global, CORS liberado (origens de dev), Swagger em `/docs`. `main.ts` e os testes e2e usam a mesma função.
  - Formato de erro (filtro global, todas as exceções): `{ "message": string, "errors"?: Record<string, string[]> }`. Validação → **422** `{ message: "Os dados enviados são inválidos.", errors: { campo: ["mensagem"] } }`; 404 de rota → `{ message: "Recurso não encontrado." }`; 500 → `{ message: "Erro interno do servidor." }` (sem stack).
  - `enum Role { Admin = 'admin', Teacher = 'teacher', Student = 'student' }` em `src/shared/enums/role.enum.ts`.
  - `@Public()` (metadata `isPublic`) e `@Roles(...roles: Role[])`; `RolesGuard` lê `request.user.role` e responde 403 `{ message: "Você não tem permissão para acessar este recurso." }`. (O `AuthGuard` global vem na Task 6; nesta task o `RolesGuard` já existe e é testado isoladamente.)
  - `class BusinessRuleException extends HttpException` → **409** `{ message }`.
  - `PrismaService extends PrismaClient` com `@prisma/adapter-pg` (connection string de `DATABASE_URL`), `onModuleInit` conecta; `PrismaModule` `@Global()`.
  - `GET /api/v1/health` (`@Public()`) → `200 { "status": "ok" }`.
  - `.env.example`: `PORT=8000`, `DATABASE_URL=postgresql://nivela:nivela@localhost:5433/nivela`, `TZ=America/Fortaleza`, `ADMIN_NAME="Administrador"`, `ADMIN_EMAIL=admin@nivela.test`, `ADMIN_PASSWORD=nivela123`. `.env.test`: mesmo, com banco `nivela_test`.
  - Scripts do workspace: `build`, `start:dev`, `lint` (`eslint "{src,test}/**/*.ts"`), `typecheck` (`tsc --noEmit`), `test` (unit), `test:e2e` (roda `scripts/test-db-reset.js` — `prisma migrate reset --force --skip-seed` no `nivela_test` — e depois `jest --config test/jest-e2e.json --runInBand`), `db:migrate` (`prisma migrate dev`), `db:seed`.
  - Alias `src/*` no `tsconfig.json` + `moduleNameMapper` no Jest (unit e e2e).
- ESLint (adaptar de `backend_estagius_nest/.eslintrc.js` para o flat config gerado pelo Nest 12): imports que saem da pasta usam `src/...` (nunca `../`); nenhum arquivo em `src/modules/A/` importa de `src/modules/B/` exceto `src/modules/B/B.module` e `src/modules/B/B.service`; `src/common`, `src/shared` e `src/prisma` não importam de `src/modules`; arquivos `*.controller.ts` não importam `PrismaService`; `@typescript-eslint/no-explicit-any` como erro.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/api-foundation`; gerar o projeto; `npm i @prisma/client@^7 @prisma/adapter-pg pg class-validator class-transformer @nestjs/swagger @nestjs/config -w apps/api`; `npm i -D prisma@^7 supertest @types/supertest @types/pg dotenv-cli -w apps/api`; `npx prisma init` (em `apps/api`) e ajustar para o Prisma 7 com adapter.
- [ ] **Step 2: Testes que falham**
  ```ts
  // test/health.e2e-spec.ts (createTestApp() usa configureApp)
  it('GET /api/v1/health → 200 {status:"ok"}', () => request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' }));
  // test/errors.e2e-spec.ts — rotas de teste registradas só no módulo de teste (TestErrorsController)
  it('rota inexistente → 404 {message}', /* GET /api/v1/nao-existe → 404, body.message === 'Recurso não encontrado.' */);
  it('DTO inválido → 422 com errors por campo', /* POST /api/v1/__test/validation {} → 422, body.errors.name[0] em pt-BR */);
  it('BusinessRuleException → 409', /* GET /api/v1/__test/conflict → 409 {message:'Saldo insuficiente.'} */);
  it('erro inesperado → 500 sem stack', /* body === { message: 'Erro interno do servidor.' } */);
  // src/common/guards/roles.guard.spec.ts
  it('libera quando o papel do usuário está em @Roles', ...); it('nega com 403 quando não está', ...); it('libera rota sem @Roles', ...);
  ```
- [ ] **Step 3:** Run `npm run test -w apps/api && npm run test:e2e -w apps/api` → FAIL.
- [ ] **Step 4:** Implementar os arquivos da lista.
- [ ] **Step 5:** Run `npm run lint -w apps/api && npm run typecheck -w apps/api && npm run test -w apps/api && npm run test:e2e -w apps/api` → PASS; `npm run dev:api` (raiz) sobe e `curl http://localhost:8000/api/v1/health` → `{"status":"ok"}`; `/docs` abre. Criar uma violação de import entre features à mão, ver o lint falhar, desfazer.
- [ ] **Step 6:** Atualizar os docs listados em Modify.
- [ ] **Step 7: Commits** `feat(api): cria projeto NestJS 12 com Prisma 7 e PostgreSQL` · `feat(api): padroniza erros JSON, validação e guard de perfil` · `feat(api): adiciona health check e documentação Swagger` · `chore(api): configura ESLint com regras de features` · `test(api): adiciona testes e2e da fundação` · `docs: atualiza documentação para o backend NestJS`

---

### Task 4: Fundação do painel web

**Branch:** `feature/web-foundation`

**Files:**
- Create: `apps/web/` via `npm create vite@latest apps/web -- --template react-ts`
- Create: `src/lib/axios.ts`, `src/lib/auth/AuthContext.tsx`, `src/lib/auth/tokenStorage.ts`, `src/lib/theme/createNivelaTheme.ts`, `src/lib/theme/ColorModeProvider.tsx`, `src/app/App.tsx`, `src/app/routes/index.tsx`, `src/app/routes/ProtectedRoute.tsx`, `src/app/layouts/AppLayout/index.tsx`, `src/app/layouts/AppLayout/menu.ts`, `src/app/layouts/AuthLayout/index.tsx`, `src/components/Mascot/index.tsx`, `src/components/EmptyState/index.tsx`, `src/components/PageHeader/index.tsx`, `src/test/setup.ts`, `src/test/server.ts`, `src/test/render.tsx`, `eslint.config.mjs`, `.env.example`
- Test: `src/app/layouts/AppLayout/AppLayout.test.tsx`, `src/lib/axios.test.ts`

**Interfaces:**
- Consumes: `@nivela/design-tokens` (`themes`, `fonts`, `radius`, `penShadow`, `mascot`).
- Produces:
  - `tokenStorage`: `getToken(): string | null`, `setToken(t: string): void`, `clearToken(): void` (chave `localStorage` `nivela.token`).
  - `src/lib/axios.ts` default export `api` (`baseURL = import.meta.env.VITE_API_URL`, `Accept: application/json`, Bearer do `tokenStorage`); interceptor de 401 chama `onUnauthorized()` registrado pelo `AuthContext` **uma vez** por sessão.
  - `type User = { id: number; name: string; email: string; role: 'admin' | 'teacher' | 'student' }` em `src/types/user.ts`.
  - `AuthContext`: `useAuth(): { user: User | null; loading: boolean; signIn(token: string, user: User): void; signOut(): Promise<void> }` (no boot, se houver token, chama `GET /auth/me`).
  - `menuItems: Array<{ label: string; path: string; icon: SvgIconComponent; roles: Role[] }>` — Início `/`, Questões `/questoes`, Planos `/planos`, Disciplinas `/disciplinas`, Categorias `/categorias`, Turmas `/turmas`, Alunos `/alunos`, Loja de prêmios `/loja`, Professores `/professores` (só admin). Rotas ainda sem feature renderizam `EmptyState` "Em breve" com o mascote.
  - `createNivelaTheme(mode: ThemeMode): Theme` — fontes Caveat (h1–h4) e Nunito (resto) via Google Fonts no `index.html`; `MuiCard`/`MuiButton` com borda 2px `border` e sombra `penShadow`; fundo do `body` pautado (`repeating-linear-gradient` com `rule`).
  - `.env.example`: `VITE_API_URL=http://localhost:8000/api/v1`.
- `eslint.config.mjs`: adaptar o do Estagius (`estagius novo/eslint.config.mjs`) — alias `src/`, feature só pelo `index.ts`, compartilhado não importa de features/app, `axios`/`src/lib/axios` só em `features/*/api` e `src/lib`, `no-explicit-any` como erro, e proibir literais hex (`/#[0-9a-fA-F]{3,8}\b/`) em `src/**` fora de `src/lib/theme`.

- [ ] **Step 1:** branch; scaffold Vite; `npm i @mui/material @mui/icons-material @emotion/react @emotion/styled react-router axios react-hook-form zod @hookform/resolvers @nivela/design-tokens -w apps/web`; devDeps `vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw`; alias `src` no `vite.config.ts` e `tsconfig`; scripts `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- [ ] **Step 2: Testes que falham**
  ```tsx
  // AppLayout.test.tsx (renderWithProviders injeta usuário no AuthContext)
  it('admin vê o menu Professores', () => { renderWithProviders(<AppLayout />, { user: admin }); expect(screen.getByRole('link', { name: /professores/i })).toBeInTheDocument(); });
  it('professor não vê o menu Professores', () => { renderWithProviders(<AppLayout />, { user: teacher }); expect(screen.queryByRole('link', { name: /professores/i })).toBeNull(); });
  it('marca o item ativo', () => { renderWithProviders(<AppLayout />, { user: teacher, route: '/questoes' }); expect(screen.getByRole('link', { name: /questões/i })).toHaveAttribute('aria-current', 'page'); });
  // axios.test.ts (MSW devolve 401 em /auth/me e em /qualquer)
  it('em 401 limpa o token e chama onUnauthorized uma única vez', async () => { /* duas requisições 401 simultâneas → onUnauthorized chamado 1x, getToken() === null */ });
  it('envia o Bearer salvo', async () => { setToken('abc'); /* MSW verifica header Authorization: Bearer abc */ });
  ```
- [ ] **Step 3:** Run `npm test -w apps/web` → FAIL.
- [ ] **Step 4:** Implementar os arquivos listados (sidebar "fichário": `Drawer` permanente 240px, fundo `text` do tema claro/`surface` no escuro, item ativo como "folha" `background` com sombra `highlight`; topo com `PageHeader`).
- [ ] **Step 5:** Run `npm test -w apps/web && npm run lint -w apps/web && npm run typecheck -w apps/web && npm run build -w apps/web` → tudo PASS.
- [ ] **Step 6: Commits** `feat(web): cria projeto React com Vite e TypeScript` · `feat(web): aplica tema Caderno Vivo no Material UI` · `feat(web): adiciona layout com barra lateral fichário` · `feat(web): adiciona cliente HTTP e contexto de autenticação` · `chore(web): configura ESLint com regras de features`
- [ ] **Step 7:** merge `--no-ff` em `develop`.

---

### Task 5: Fundação do app mobile

**Branch:** `feature/mobile-foundation`

**Files:**
- Create: `apps/mobile/` via `npx create-expo-app@latest apps/mobile --template blank-typescript --no-install` (depois `npm install` na raiz)
- Create: `app/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/welcome.tsx` (provisória), `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/study.tsx`, `app/(tabs)/store.tsx`, `app/(tabs)/profile.tsx`, `src/lib/axios.ts`, `src/lib/auth/AuthContext.tsx`, `src/lib/auth/tokenStorage.ts`, `src/lib/theme/ThemeProvider.tsx`, `src/lib/theme/useTheme.ts`, `src/components/Mascot.tsx`, `src/components/PaperBackground.tsx`, `src/components/PenCard.tsx`, `src/components/EmptyState.tsx`, `src/test/render.tsx`, `eslint.config.mjs`, `.env.example`
- Test: `app/(tabs)/__tests__/tabs.test.tsx`, `src/lib/__tests__/axios.test.ts`

**Interfaces:**
- Consumes: `@nivela/design-tokens`.
- Produces:
  - `tokenStorage` (mesma assinatura da web, **assíncrona**): `getToken(): Promise<string|null>`, `setToken(t): Promise<void>`, `clearToken(): Promise<void>` via `expo-secure-store`, chave `nivela.token`.
  - `src/lib/axios.ts` default `api` (`baseURL = process.env.EXPO_PUBLIC_API_URL`), mesmo contrato de 401 da web.
  - `useAuth()` com o mesmo formato da web.
  - `useTheme(): { colors: ThemeColors; mode: ThemeMode; fonts }` — segue o esquema do sistema (`useColorScheme`).
  - Abas com rótulos **Início**, **Estudar**, **Loja**, **Perfil**; navegação protegida com `Stack.Protected guard={!!user}` (grupo `(tabs)`) e `guard={!user}` (grupo `(auth)`).
  - Fontes `@expo-google-fonts/caveat` e `@expo-google-fonts/nunito` carregadas no `_layout` (splash até carregar).
  - `.env.example`: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1` (emulador Android; celular físico usa o IP da máquina — documentar no README).
- `eslint.config.mjs`: mesmas regras da web (alias `src/`, features, axios, sem `any`, sem hex fora de `src/lib/theme`).

- [ ] **Step 1:** branch; scaffold; `npx expo install expo-router expo-secure-store expo-font expo-splash-screen react-native-svg react-native-reanimated react-native-safe-area-context react-native-screens expo-linking expo-constants` (dentro de `apps/mobile`); `npm i axios react-hook-form zod @hookform/resolvers @nivela/design-tokens @expo-google-fonts/caveat @expo-google-fonts/nunito -w apps/mobile`; devDeps `jest-expo @testing-library/react-native`; `"main": "expo-router/entry"`; scripts `start`, `android`, `lint`, `typecheck`, `test` (`jest`).
- [ ] **Step 2: Testes que falham**
  ```tsx
  // tabs.test.tsx (renderRouter do expo-router/testing-library com usuário logado)
  it('mostra as quatro abas', async () => { /* render (tabs) com user aluno */ for (const l of ['Início','Estudar','Loja','Perfil']) expect(await screen.findByText(l)).toBeTruthy(); });
  it('sem usuário, abre a tela de boas-vindas', async () => { /* user null → pathname '/welcome' */ });
  // axios.test.ts
  it('em 401 limpa o token e chama onUnauthorized uma única vez', async () => { /* mock do adapter devolvendo 401 em duas requisições */ });
  ```
- [ ] **Step 3:** Run `npm test -w apps/mobile` → FAIL.
- [ ] **Step 4:** Implementar (fundo pautado `PaperBackground`, `PenCard` com borda 2px + sombra sólida — no Android simular a sombra com uma `View` deslocada atrás do card).
- [ ] **Step 5:** Run `npm test -w apps/mobile && npm run lint -w apps/mobile && npm run typecheck -w apps/mobile` → PASS; `npx expo export --platform android` (em `apps/mobile`) conclui sem erro (prova que o Metro resolve o workspace).
- [ ] **Step 6: Commits** `feat(mobile): cria app Expo com Expo Router` · `feat(mobile): aplica tema Caderno Vivo e fontes` · `feat(mobile): adiciona navegação por abas protegida` · `feat(mobile): adiciona cliente HTTP e contexto de autenticação` · `chore(mobile): configura ESLint e Jest`
- [ ] **Step 7:** merge `--no-ff` em `develop`.

---

### Task 6: Autenticação na API

**Branch:** `feature/auth` (as Tasks 6, 7 e 8 usam a mesma branch; o merge acontece no fim da Task 8)

**Files:**
- Modify: `prisma/schema.prisma` (models `User`, `StudentProfile`, `AccessToken`, `Classroom`, `ClassroomStudent` + enum `Role`) → migration `prisma/migrations/<timestamp>_auth/` via `npm run db:migrate -w apps/api -- --name auth`
- Create: `src/modules/auth/{auth.module.ts, auth.controller.ts, auth.service.ts, auth.service.spec.ts, token.service.ts, dto/login.dto.ts, dto/register-student.dto.ts, dto/change-password.dto.ts, presenters/user.presenter.ts}`, `src/common/guards/auth.guard.ts` (registrado como `APP_GUARD` antes do `RolesGuard`), `src/common/decorators/current-user.decorator.ts`, `src/modules/classrooms/{classrooms.module.ts, join-code.service.ts, join-code.service.spec.ts}`, `prisma/seed.ts`, `test/helpers/factories.ts`
- Test: `test/auth-login.e2e-spec.ts`, `test/auth-register.e2e-spec.ts`, `test/auth-session.e2e-spec.ts`

**Interfaces:**
- Consumes: `configureApp`, `Role`, `@Public()`, `@Roles()`, `RolesGuard`, `BusinessRuleException`, `PrismaService`, formato de erro 422 (Task 3).
- Produces (Plano 2 depende disto):
  - Tabelas (spec §6): `users` (+ `role` enum `admin|teacher|student` default `student`, `active` default true, `email` único), `student_profiles` (`user_id` PK/FK cascade, `coins_balance`/`current_streak`/`best_streak` int default 0, `last_study_date` date null), `access_tokens` (`id`, `user_id` FK cascade, `token_hash` char(64) único, `channel` `web|mobile`, `last_used_at` null, `created_at`), `classrooms` (`id`, `teacher_id` FK users, `name`, `school_year` null, `join_code` varchar(8) único, `active` default true, timestamps), `classroom_student` (`classroom_id`, `student_id`, `joined_at`, PK composta).
  - `TokenService`: `issue(userId: number, channel: 'web' | 'mobile'): Promise<string>` (32 bytes aleatórios em hex; grava o SHA-256), `resolve(plain: string): Promise<AuthUser | null>` (atualiza `last_used_at`), `revoke(plain: string): Promise<void>`.
  - `type AuthUser = { id: number; name: string; email: string; role: Role }`; `@CurrentUser()` devolve o `AuthUser`; o token atual fica em `request.accessToken` para o logout.
  - `AuthGuard` (global): rota `@Public()` passa; senão exige `Authorization: Bearer <token>` válido de usuário ativo, senão 401 `{ message: "Não autenticado." }`.
  - `JoinCodeService`: `generate(): Promise<string>` → `NIV-` + 4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, único na tabela; `static normalize(raw: string): string` → trim + maiúsculas. Exportado pelo `ClassroomsModule`.
  - `presentUser(user) → { id, name, email, role }`.
  - Rotas (`AuthController`, prefixo `auth`):
    | Método e rota | Corpo | Sucesso | Erros |
    |---|---|---|---|
    | `POST /auth/login` (`@Public`) | `email`, `password`, `channel` (`web`\|`mobile`) | `200 { token, user }` | 422 `errors.email=["E-mail ou senha inválidos."]`; 403 `"Usuário desativado."`; 403 aluno no web: `"Alunos acessam pelo aplicativo Nivela."`; 403 professor/admin no mobile: `"Professores e administradores acessam pelo painel web."` |
    | `POST /auth/register-student` (`@Public`) | `name`, `email`, `password` (min 8), `password_confirmation`, `join_code` | `201 { token, user }` + `student_profile` criado + vínculo na turma (canal `mobile`) | 422 `email` duplicado `"Este e-mail já está cadastrado."`; `join_code` inexistente `"Código de turma inválido."`; turma inativa `"Esta turma não está aceitando novos alunos."`; `password_confirmation` diferente `"A confirmação de senha não confere."` |
    | `GET /auth/me` | — | `200 { user }` | 401 |
    | `POST /auth/logout` | — | `204`, token atual apagado | 401 |
    | `PUT /auth/password` | `current_password`, `password`, `password_confirmation` | `204` | 422 `current_password=["A senha atual está incorreta."]` |
  - Campos do JSON em `snake_case` (como na tabela acima) — os DTOs usam esses nomes.
  - E-mail sempre normalizado (trim + minúsculas) em login e cadastro (`@Transform` no DTO); código da turma normalizado com `JoinCodeService.normalize`.
  - `prisma/seed.ts` cria o admin a partir de `ADMIN_*` se não existir (`npm run db:seed -w apps/api`; `prisma.seed` configurado).

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/auth`
- [ ] **Step 2: Testes que falham** (e2e com banco limpo por arquivo; factories criam usuários/turmas direto no Prisma)
  ```ts
  // test/auth-login.e2e-spec.ts
  it('faz login do professor pelo web', /* teacher com senha 'segredo123' → POST /api/v1/auth/login {channel:'web'} → 200, body.user.role === 'teacher', typeof body.token === 'string' */);
  it('aceita e-mail com maiúsculas e espaços', /* cadastrado 'ana@escola.com', login com ' Ana@Escola.com ' → 200 */);
  it('recusa senha errada', /* 422, body.errors.email[0] === 'E-mail ou senha inválidos.' */);
  it('recusa usuário desativado', /* 403, body.message === 'Usuário desativado.' */);
  it('recusa aluno no canal web', /* 403, 'Alunos acessam pelo aplicativo Nivela.' */);
  it('recusa professor no canal mobile', /* 403, 'Professores e administradores acessam pelo painel web.' */);
  it('guarda só o hash do token', /* access_tokens.token_hash !== body.token e === sha256(body.token) */);
  // test/auth-register.e2e-spec.ts
  it('cadastra aluno com código da turma', /* turma ativa 'NIV-4K7Q' → 201, user.role 'student', student_profiles.coins_balance 0, classroom_student com o vínculo */);
  it('aceita código em minúsculas com espaços', /* join_code ' niv-4k7q ' → 201 */);
  it('recusa código inexistente', /* 422 errors.join_code[0] === 'Código de turma inválido.' */);
  it('recusa turma inativa', /* 422 errors.join_code[0] === 'Esta turma não está aceitando novos alunos.' */);
  it('recusa e-mail já cadastrado, inclusive com maiúsculas', /* 422 errors.email[0] === 'Este e-mail já está cadastrado.' */);
  it('exige senha de 8 caracteres e confirmação igual', /* 422 em password e em password_confirmation */);
  it('não cria nada se o vínculo falhar', /* cadastro é transacional: código inválido → nenhum user criado */);
  // test/auth-session.e2e-spec.ts
  it('retorna o usuário logado', ...); it('logout revoga o token', /* depois do logout, GET /auth/me com o mesmo token → 401 */);
  it('troca a senha', /* login com a nova senha funciona */); it('recusa senha atual errada', /* 422 'A senha atual está incorreta.' */);
  it('exige autenticação', /* GET /auth/me sem token → 401 {message:'Não autenticado.'}; com token inventado → 401 */);
  it('usuário desativado depois do login perde o acesso', /* active=false → GET /auth/me → 401 */);
  // src/modules/classrooms/join-code.service.spec.ts
  it('gera no formato NIV-XXXX sem caracteres ambíguos', /* toMatch(/^NIV-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/) */);
  it('normaliza', () => expect(JoinCodeService.normalize(' niv-4k7q ')).toBe('NIV-4K7Q'));
  it('tenta de novo se o código já existe', /* prisma mock: primeiro código existe, segundo não */);
  ```
- [ ] **Step 3:** Run `npm run test -w apps/api && npm run test:e2e -w apps/api` → FAIL.
- [ ] **Step 4:** Schema + migration; `TokenService`, `AuthGuard`, `@CurrentUser`; `JoinCodeService`.
- [ ] **Step 5:** `AuthService` (`login(dto): Promise<{ token: string; user: AuthUser }>`, `registerStudent(dto)` em `prisma.$transaction`, `changePassword(userId, dto)`), DTOs, controller; seed.
- [ ] **Step 6:** Run `npm run lint -w apps/api && npm run typecheck -w apps/api && npm run test -w apps/api && npm run test:e2e -w apps/api` → PASS; `npx prisma migrate reset --force` (em `apps/api`) recria o banco e o seed cria o admin.
- [ ] **Step 7: Commits** `feat(api): adiciona perfis, tokens de acesso e turmas ao schema` · `feat(api): implementa guard de autenticação por token` · `feat(api): implementa login por canal` · `feat(api): implementa cadastro de aluno por código da turma` · `feat(api): adiciona perfil, logout e troca de senha` · `feat(api): cria seed do administrador` · `test(api): cobre regras de autenticação`

---

### Task 7: Autenticação no painel web

**Branch:** `feature/auth` (continuação)

**Files:**
- Create: `src/features/auth/api/auth.api.ts`, `src/features/auth/schemas/login.schema.ts`, `src/features/auth/pages/Login/index.tsx`, `src/features/auth/pages/Profile/index.tsx`, `src/features/auth/index.ts`
- Modify: `src/app/routes/index.tsx` (rota `/login` pública dentro do `AuthLayout`, `/perfil` protegida), `src/lib/auth/AuthContext.tsx` (usar `getMe`/`logout` da feature via `index.ts` não é permitido em `lib` → o `AuthContext` recebe as funções por props a partir de `src/app/App.tsx`)
- Test: `src/features/auth/pages/Login/Login.test.tsx`, `src/features/auth/pages/Profile/Profile.test.tsx`

**Interfaces:**
- Consumes: `api`, `useAuth`, `AuthLayout`, `User` (Task 4); rotas da Task 6.
- Produces: `login(data: { email: string; password: string }) → AxiosResponse<{ token: string; user: User }>` (envia `channel: 'web'`), `getMe()`, `logout()`, `changePassword(data)`.
- Tela de login: card "caderno" centralizado com mascote, título manuscrito "Nivela", campos e-mail/senha, botão "Entrar"; erro da API exibido acima do botão (`role="alert"`). Perfil: troca de senha + alternância de tema claro/escuro (persistida em `localStorage` `nivela.colorMode`).

- [ ] **Step 1: Testes que falham** (MSW)
  ```tsx
  it('entra e vai para o Início', /* POST /auth/login 200 → navega para '/', texto do PageHeader do Início visível */);
  it('mostra erro de credenciais', /* 422 → alert 'E-mail ou senha inválidos.' */);
  it('mostra a mensagem para aluno', /* 403 → alert 'Alunos acessam pelo aplicativo Nivela.' */);
  it('valida campos vazios sem chamar a API', /* clicar Entrar → 'Informe seu e-mail' e 'Informe sua senha'; nenhuma requisição */);
  it('rota protegida sem login redireciona para /login', ...);
  it('troca a senha e mostra confirmação', /* PUT 204 → 'Senha alterada com sucesso.' */);
  ```
- [ ] **Step 2:** Run `npm test -w apps/web` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test -w apps/web && npm run lint -w apps/web && npm run typecheck -w apps/web` → PASS. Manual: API + `npm run dev:web`, login com o admin do seeder.
- [ ] **Step 5: Commits** `feat(web): adiciona tela de login` · `feat(web): adiciona perfil com troca de senha e tema` · `test(web): cobre fluxo de login`

---

### Task 8: Autenticação no app mobile

**Branch:** `feature/auth` (continuação; merge no fim)

**Files:**
- Create: `src/features/auth/api/auth.api.ts`, `src/features/auth/schemas/{login,register}.schema.ts`, `app/(auth)/welcome.tsx` (definitiva), `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `src/features/auth/components/AuthForm.tsx`, `src/features/auth/index.ts`, `app/(tabs)/profile.tsx` (dados + sair)
- Test: `src/features/auth/__tests__/register.test.tsx`, `login.test.tsx`

**Interfaces:**
- Consumes: `api`, `useAuth`, `tokenStorage`, componentes da Task 5; rotas da Task 6 (`channel: 'mobile'`).
- Produces: `login(data)`, `registerStudent(data: { name; email; password; password_confirmation; join_code })`, `getMe()`, `logout()`.
- Boas-vindas: mascote grande, título manuscrito "Oi! Bora nivelar?", botões "Entrar" e "Tenho um código de turma". Cadastro: código da turma em destaque (maiúsculas automáticas), nome, e-mail, senha, confirmar senha. Erros de campo da API (422) aparecem no campo correspondente.

- [ ] **Step 1: Testes que falham**
  ```tsx
  it('cadastra e entra no app', /* POST register 201 → setToken chamado, rota '/(tabs)' */);
  it('mostra erro da API no campo do código', /* 422 errors.join_code → texto 'Código de turma inválido.' perto do campo */);
  it('valida confirmação de senha', /* senhas diferentes → 'As senhas não conferem'; nenhuma requisição */);
  it('login com mensagem de professor', /* 403 → 'Professores e administradores acessam pelo painel web.' */);
  it('sair limpa o token e volta para boas-vindas', ...);
  ```
- [ ] **Step 2:** Run `npm test -w apps/mobile` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Run `npm test -w apps/mobile && npm run lint -w apps/mobile && npm run typecheck -w apps/mobile` → PASS. Manual (se houver emulador/Expo Go): cadastro com uma turma criada direto no banco (`npx prisma studio` em `apps/api`).
- [ ] **Step 5: Commits** `feat(mobile): adiciona boas-vindas com o mascote` · `feat(mobile): adiciona login e cadastro por código da turma` · `feat(mobile): adiciona perfil com sair` · `test(mobile): cobre cadastro e login`
- [ ] **Step 6:** `git checkout develop && git merge --no-ff feature/auth && git branch -d feature/auth`

---

### Task 9: Integração contínua

**Branch:** `feature/ci`

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (badge do CI e comandos de teste), `docs/workflow.md` (o que o CI verifica)

**Interfaces:**
- Jobs em `push` para `develop`/`main` e `pull_request`, com `concurrency` cancelando execuções antigas; todos com Node 22 e `npm ci` na raiz:
  - `api`: serviço `postgres:17-alpine` (usuário/senha `nivela`, banco `nivela_test`, porta 5432); env `DATABASE_URL=postgresql://nivela:nivela@localhost:5432/nivela_test`; `lint`, `typecheck`, `test`, `test:e2e` do workspace `apps/api`.
  - `web`: `lint`, `typecheck`, `test`, `build` do workspace web; `test` e `typecheck` de `packages/design-tokens`.
  - `mobile`: `lint`, `typecheck`, `test` do workspace mobile.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/ci`; escrever o workflow.
- [ ] **Step 2: Verificar localmente o que o CI roda**
  Run: `npm ci && npm run lint && npm test && npm run test:e2e -w apps/api`
  Expected: tudo PASS. Validar o YAML com `npx --yes @action-validator/cli .github/workflows/ci.yml` sem erros.
- [ ] **Step 3: Commits** `ci: adiciona pipeline de lint, tipos, testes e build` · `docs: documenta o pipeline de CI`
