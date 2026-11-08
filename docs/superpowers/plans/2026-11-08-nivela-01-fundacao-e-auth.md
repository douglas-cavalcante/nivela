# Nivela — Plano 1: Fundação e Autenticação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo funcionando com API Laravel, painel web e app Expo integrados, identidade "Caderno Vivo" aplicada e login/cadastro de ponta a ponta para os três perfis.

**Architecture:** npm workspaces (`apps/web`, `apps/mobile`, `packages/*`) + `apps/api` em Composer. Web e mobile consomem `@nivela/design-tokens` (TS puro, sem build). API REST `/api/v1` com Sanctum Bearer; código por feature em `app/Modules/<Feature>`.

**Tech Stack:** Laravel 12.x (PHP 8.2), Sanctum, Pest 3, Scribe, PostgreSQL 17 (Docker) · React 19 + Vite 8 + TS + MUI 9 + React Router 8 + Axios + react-hook-form + zod + Vitest + MSW · Expo SDK 58 + Expo Router + expo-secure-store + react-native-svg + jest-expo.

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

- Ambiente: Windows 11, comandos em Git Bash; PHP 8.2.12 (XAMPP, `pdo_pgsql` habilitado), Composer 2.6, Node 22, npm 10. **Docker Desktop precisa estar aberto** antes da Task 1.
- Laravel `^12.0` (não 13 — exige PHP 8.3). Pest `^3.8` (Pest 4/5 exigem PHP ≥ 8.3/8.4).
- Banco: `postgres:17-alpine`, porta host **5433**, usuário/senha `nivela`/`nivela`, bancos `nivela` e `nivela_test`.
- API em `http://localhost:8000/api/v1` (`php artisan serve --host=0.0.0.0 --port=8000`).
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

### Task 3: Fundação da API

**Branch:** `feature/api-foundation`

**Files:**
- Create: `apps/api/` via `composer create-project laravel/laravel:^12.0 apps/api`
- Create: `app/Support/Http/Middleware/EnsureRole.php`, `app/Shared/Enums/Role.php`, `app/Shared/Exceptions/BusinessRuleException.php`, `app/Modules/System/Controllers/HealthController.php`, `app/Modules/System/routes.php`
- Modify: `routes/api.php`, `bootstrap/app.php`, `.env.example`, `phpunit.xml`, `config/database.php` (default `pgsql`), `lang/pt_BR/*` (via `laravel-lang/common` ou arquivos próprios), `config/app.php` (`locale=pt_BR`, `timezone=America/Fortaleza`)
- Test: `tests/Feature/System/HealthTest.php`, `tests/Arch/ModulesTest.php`

**Interfaces:**
- Produces:
  - `routes/api.php`: `Route::prefix('v1')->group(fn () => collect(glob(app_path('Modules/*/routes.php')))->each(fn ($f) => require $f));` — cada feature registra suas rotas em `app/Modules/<Feature>/routes.php`.
  - `enum App\Shared\Enums\Role: string { case Admin = 'admin'; case Teacher = 'teacher'; case Student = 'student'; }`
  - Middleware alias `role` → `EnsureRole::handle($request, $next, string ...$roles)`; 403 `{"message":"Você não tem permissão para acessar este recurso."}`.
  - `BusinessRuleException(string $message)` → renderiza `409 {"message": $message}` (registrado em `bootstrap/app.php` → `withExceptions`).
  - Todas as respostas de erro em JSON para rotas `api/*` (`shouldRenderJsonWhen`).
  - `GET /api/v1/health` → `200 {"status":"ok"}`.
- `.env.example`: `DB_CONNECTION=pgsql`, `DB_PORT=5433`, `DB_DATABASE=nivela`, `DB_USERNAME=nivela`, `DB_PASSWORD=nivela`, `APP_LOCALE=pt_BR`, `ADMIN_NAME="Administrador"`, `ADMIN_EMAIL=admin@nivela.test`, `ADMIN_PASSWORD=nivela123`. `phpunit.xml`: `DB_DATABASE=nivela_test`.

- [ ] **Step 1:** branch; `composer create-project laravel/laravel:^12.0 apps/api`; `cd apps/api && php artisan install:api` (Sanctum + `routes/api.php`); `composer require --dev pestphp/pest:^3.8 pestphp/pest-plugin-laravel:^3.0 laravel/pint knuckleswtf/scribe`; `./vendor/bin/pest --init`. Remover `tests/Unit/ExampleTest.php` e `tests/Feature/ExampleTest.php`.
- [ ] **Step 2:** Configurar `.env`/`.env.example`/`phpunit.xml`/locale/timezone conforme acima; `php artisan migrate` → tabelas criadas no `nivela`.
- [ ] **Step 3: Testes que falham**
  ```php
  // tests/Feature/System/HealthTest.php
  it('responde o health check', fn () => $this->getJson('/api/v1/health')->assertOk()->assertExactJson(['status' => 'ok']));
  it('responde 404 em JSON', fn () => $this->getJson('/api/v1/nao-existe')->assertNotFound()->assertJsonStructure(['message']));
  // tests/Arch/ModulesTest.php
  arch('núcleo não depende de features')->expect(['App\Shared', 'App\Support'])->not->toUse('App\Modules');
  ```
  Mais dois testes no mesmo arquivo, como **varredura de arquivos** (a API de arch do Pest não filtra por subpasta de cada módulo):
  - `it('controllers não acessam o banco direto')`: nenhum `app/Modules/*/Controllers/*.php` contém `Illuminate\Support\Facades\DB`.
  - `it('features não usam internos de outras features')`: nenhum arquivo em `app/Modules/A/` contém `use App\Modules\B\(Controllers|Requests|Resources|Policies)\` com `A ≠ B`.
  Ambos devem passar com o código atual e ter um caso negativo verificado à mão uma vez (criar violação, ver falhar, desfazer).
- [ ] **Step 4:** Run `./vendor/bin/pest` → FAIL.
- [ ] **Step 5:** Implementar roteamento por módulos, `HealthController` (invokable), `Role`, `EnsureRole`, `BusinessRuleException` e o render JSON.
- [ ] **Step 6:** Run `./vendor/bin/pest && ./vendor/bin/pint --test` → PASS.
- [ ] **Step 7:** Configurar Scribe (`php artisan vendor:publish --tag=scribe-config`; `type: laravel`, rotas `api/v1/*`, título "API Nivela"); `php artisan scribe:generate` sem erros; `/docs` abre. Adicionar `composer` scripts `test` (`pest`), `lint` (`pint --test`).
- [ ] **Step 8: Commits** `feat(api): cria projeto Laravel 12 com Sanctum e PostgreSQL` · `feat(api): organiza rotas por módulos e adiciona health check` · `feat(api): padroniza erros JSON e middleware de perfil` · `test(api): adiciona testes de arquitetura dos módulos` · `docs(api): gera documentação com Scribe`
- [ ] **Step 9:** merge `--no-ff` em `develop`.

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
- Create: `database/migrations/*_add_role_and_active_to_users_table.php`, `*_create_student_profiles_table.php`, `*_create_classrooms_table.php`, `*_create_classroom_student_table.php`
- Create (mover): `app/Modules/Users/Models/User.php` (de `app/Models/User.php`; atualizar `config/auth.php` e `UserFactory`), `app/Modules/Students/Models/StudentProfile.php`, `app/Modules/Classrooms/Models/Classroom.php`, `app/Modules/Classrooms/Services/JoinCodeGenerator.php`
- Create: `app/Modules/Auth/{Controllers/AuthController.php, Requests/LoginRequest.php, Requests/RegisterStudentRequest.php, Requests/ChangePasswordRequest.php, Resources/UserResource.php, Services/AuthService.php, routes.php}`, `database/seeders/AdminSeeder.php`, factories `ClassroomFactory`, `StudentProfileFactory`
- Test: `tests/Feature/Auth/LoginTest.php`, `RegisterStudentTest.php`, `MeLogoutPasswordTest.php`, `tests/Unit/Classrooms/JoinCodeGeneratorTest.php`

**Interfaces:**
- Consumes: `Role`, `role` middleware, `BusinessRuleException` (Task 3).
- Produces (Plano 2 depende disto):
  - `users`: + `role` (string, default `student`, cast `Role`), `active` (bool, default true). `User::isAdmin()`, `isTeacher()`, `isStudent()`; relação `studentProfile(): HasOne`, `classrooms(): BelongsToMany` (alunos), `ownedClassrooms(): HasMany` (professor).
  - `student_profiles`: `user_id` PK/FK cascade, `coins_balance` int default 0, `current_streak`/`best_streak` int default 0, `last_study_date` date null.
  - `classrooms`: `id`, `teacher_id` FK users, `name`, `school_year` (string null), `join_code` string(8) único, `active` bool default true, timestamps. `classroom_student`: `classroom_id`, `student_id`, `joined_at`, PK composta.
  - `JoinCodeGenerator::generate(): string` → `NIV-` + 4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, único na tabela. `JoinCodeGenerator::normalize(string $raw): string` → trim + maiúsculas.
  - `UserResource` → `{ id, name, email, role }`.
  - Rotas (`app/Modules/Auth/routes.php`):
    | Método e rota | Corpo | Sucesso | Erros |
    |---|---|---|---|
    | `POST /auth/login` | `email`, `password`, `channel` (`web`\|`mobile`) | `200 { token, user }` | 422 `errors.email=["E-mail ou senha inválidos."]`; 403 `"Usuário desativado."`; 403 aluno no web: `"Alunos acessam pelo aplicativo Nivela."`; 403 professor/admin no mobile: `"Professores e administradores acessam pelo painel web."` |
    | `POST /auth/register-student` | `name`, `email`, `password` (min 8), `password_confirmation`, `join_code` | `201 { token, user }` + `student_profile` criado + vínculo na turma | 422 `email` duplicado `"Este e-mail já está cadastrado."`; `join_code` inexistente `"Código de turma inválido."`; turma inativa `"Esta turma não está aceitando novos alunos."` |
    | `GET /auth/me` (auth) | — | `200 { user }` | 401 |
    | `POST /auth/logout` (auth) | — | `204`, token atual revogado | 401 |
    | `PUT /auth/password` (auth) | `current_password`, `password`, `password_confirmation` | `204` | 422 `current_password=["A senha atual está incorreta."]` |
  - E-mail sempre normalizado (trim + minúsculas) em login e cadastro (`prepareForValidation`).
  - `AdminSeeder` cria o admin a partir de `ADMIN_*` do `.env` se não existir; chamado pelo `DatabaseSeeder`.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/auth`
- [ ] **Step 2: Testes que falham** (todos com `RefreshDatabase`)
  ```php
  // LoginTest.php
  it('faz login do professor pelo web', fn () => /* teacher factory, senha 'segredo123' */ postJson('/api/v1/auth/login', [...,'channel'=>'web'])->assertOk()->assertJsonPath('user.role','teacher')->assertJsonStructure(['token']));
  it('aceita e-mail com maiúsculas e espaços', /* email cadastrado 'ana@escola.com', login com ' Ana@Escola.com ' → 200 */);
  it('recusa senha errada', /* 422, errors.email[0] === 'E-mail ou senha inválidos.' */);
  it('recusa usuário desativado', /* 403, message 'Usuário desativado.' */);
  it('recusa aluno no canal web', /* 403, 'Alunos acessam pelo aplicativo Nivela.' */);
  it('recusa professor no canal mobile', /* 403, 'Professores e administradores acessam pelo painel web.' */);
  // RegisterStudentTest.php
  it('cadastra aluno com código da turma', /* turma ativa 'NIV-4K7Q' → 201, user.role 'student', student_profiles com coins_balance 0, classroom_student com o vínculo */);
  it('aceita código em minúsculas com espaços', /* join_code ' niv-4k7q ' → 201 */);
  it('recusa código inexistente', /* 422 errors.join_code[0] === 'Código de turma inválido.' */);
  it('recusa turma inativa', /* 422 errors.join_code[0] === 'Esta turma não está aceitando novos alunos.' */);
  it('recusa e-mail já cadastrado', /* 422 errors.email[0] === 'Este e-mail já está cadastrado.' (inclusive com maiúsculas) */);
  it('exige senha de 8 caracteres e confirmação', /* 422 em password */);
  // MeLogoutPasswordTest.php
  it('retorna o usuário logado', ...); it('logout revoga o token', /* depois do logout, GET /auth/me com o mesmo token → 401 */);
  it('troca a senha', ...); it('recusa senha atual errada', /* 422 'A senha atual está incorreta.' */);
  it('exige autenticação', /* GET /auth/me sem token → 401 */);
  // JoinCodeGeneratorTest.php
  it('gera no formato NIV-XXXX sem caracteres ambíguos', fn () => expect(app(JoinCodeGenerator::class)->generate())->toMatch('/^NIV-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/'));
  it('normaliza', fn () => expect(JoinCodeGenerator::normalize(' niv-4k7q '))->toBe('NIV-4K7Q'));
  ```
- [ ] **Step 3:** Run `./vendor/bin/pest tests/Feature/Auth tests/Unit/Classrooms` → FAIL.
- [ ] **Step 4:** Migrations, models e mover `User`; `JoinCodeGenerator`.
- [ ] **Step 5:** `AuthService` (`login(string $email, string $password, string $channel): array{token:string,user:User}`, `registerStudent(array $data): array{…}` em `DB::transaction`), requests, resource, controller, rotas; `AdminSeeder`.
- [ ] **Step 6:** Run `./vendor/bin/pest && ./vendor/bin/pint --test` → PASS; `php artisan migrate:fresh --seed` cria o admin.
- [ ] **Step 7: Commits** `feat(api): adiciona perfis e status aos usuários` · `feat(api): cria turmas com código de entrada` · `feat(api): implementa login por canal com Sanctum` · `feat(api): implementa cadastro de aluno por código da turma` · `feat(api): adiciona perfil, logout e troca de senha` · `test(api): cobre regras de autenticação`

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
- [ ] **Step 4:** Run `npm test -w apps/mobile && npm run lint -w apps/mobile && npm run typecheck -w apps/mobile` → PASS. Manual (se houver emulador/Expo Go): cadastro com uma turma criada via `php artisan tinker`.
- [ ] **Step 5: Commits** `feat(mobile): adiciona boas-vindas com o mascote` · `feat(mobile): adiciona login e cadastro por código da turma` · `feat(mobile): adiciona perfil com sair` · `test(mobile): cobre cadastro e login`
- [ ] **Step 6:** `git checkout develop && git merge --no-ff feature/auth && git branch -d feature/auth`

---

### Task 9: Integração contínua

**Branch:** `feature/ci`

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (badge do CI e comandos de teste), `docs/workflow.md` (o que o CI verifica)

**Interfaces:**
- Jobs em `push` para `develop`/`main` e `pull_request`, com `concurrency` cancelando execuções antigas:
  - `api`: `ubuntu-latest`, serviço `postgres:17-alpine` (db `nivela_test`), `shivammathur/setup-php` PHP 8.2 com `pdo_pgsql`, `composer install`, `cp .env.example .env`, `php artisan key:generate`, `pint --test`, `pest` (env `DB_HOST=127.0.0.1`, `DB_PORT=5432`).
  - `web`: Node 22, `npm ci` na raiz, `lint`, `typecheck`, `test`, `build` do workspace web; `test` do `packages/design-tokens`.
  - `mobile`: Node 22, `npm ci`, `lint`, `typecheck`, `test` do workspace mobile.

- [ ] **Step 1:** Escrever o workflow.
- [ ] **Step 2: Verificar localmente o que o CI roda**
  Run: `npm ci && npm run lint && npm test && (cd apps/api && ./vendor/bin/pint --test && ./vendor/bin/pest)`
  Expected: tudo PASS. Validar o YAML com `npx --yes @action-validator/cli .github/workflows/ci.yml` (ou equivalente) sem erros.
- [ ] **Step 3: Commits** `ci: adiciona pipeline de lint, tipos, testes e build` · `docs: documenta o pipeline de CI`
- [ ] **Step 4:** merge `--no-ff` em `develop`. (O CI só roda de verdade quando o usuário autorizar o push para o GitHub.)
