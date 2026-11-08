# Arquitetura do Nivela

O **Nivela** é uma plataforma open source de apoio ao nivelamento estudantil na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada.

## Visão geral

```
Professor/Admin ──► apps/web (React + MUI) ─┐
                                            ├─ HTTPS/JSON · Bearer token ─► apps/api (NestJS 12) ─► PostgreSQL 17
Aluno ───────────► apps/mobile (Expo)  ─────┘
packages/design-tokens ──► consumido por web e mobile
packages/api-contract  ──► tipos de resposta + parseApiError: consumido por api (só `import type`), web e mobile
```

- A **API** concentra toda a regra de negócio e é a única a acessar o banco.
- **Web** (professor/admin) e **mobile** (aluno) são clientes da mesma API REST em `/api/v1`.
- O login informa o canal (`web` ou `mobile`) e a API valida o perfil do canal.
- O pacote `design-tokens` garante a mesma identidade visual ("Caderno Vivo") nos dois clientes.
- O pacote `api-contract` (`@nivela/api-contract`, TS puro, sem build) é a fonte única dos **tipos de resposta da API** (`ApiUser`, `Role`, `Paginated`, `ErrorBody`...) e do `parseApiError`. Regra: tipos de resposta só no contrato — web e mobile não os redefinem. A API importa dele **apenas com `import type`** (regra de ESLint), pois a parte de runtime depende de `axios`.

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| API | NestJS 12 (Node 22, TypeScript 6) | Monorepo inteiro em TypeScript e mesmo padrão do backend do projeto Estagius; organização por módulos de feature |
| ORM | Prisma 7 com `@prisma/adapter-pg` | Schema declarativo, migrations versionadas e client tipado; o Prisma 8 ainda está em RC |
| Autenticação | Token opaco (personal access token) | Guarda só o hash SHA-256 no banco; o mesmo token Bearer atende web e mobile e é revogável no logout |
| Banco | PostgreSQL 17 (Docker, porta host 5433) | Transações e `SELECT … FOR UPDATE` para moedas e resgates |
| Validação | class-validator + class-transformer | DTOs com mensagens em pt-BR, erro 422 por campo |
| Testes da API | Jest + supertest, ESLint + Prettier | Unitários dos services e e2e contra o banco `nivela_test` |
| Documentação da API | Swagger (`@nestjs/swagger`) em `/docs` | Gerada a partir do código |
| Web | Vite, React 19, TypeScript estrito, Material UI, React Router, Axios, react-hook-form + zod, Recharts | Painel administrativo com formulários e gráficos |
| Testes da web | Vitest + Testing Library + MSW | Testes de integração sem backend real |
| Mobile | Expo (SDK 58), Expo Router, TypeScript estrito, Axios, expo-secure-store, Reanimated, react-native-svg | Android como alvo principal e iOS via Expo |
| Testes do mobile | jest-expo + Testing Library | Testes de tela e fluxo no padrão do Expo |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) | Um `npm install` na raiz atende todos os apps |
| CI | GitHub Actions | Lint, tipos, testes e build a cada push/PR |

A organização interna de cada app está em [estruturaDePastas.md](estruturaDePastas.md).

### Notas sobre TypeScript e ferramentas da API

- O TypeScript da raiz é o `~6.0`: as ferramentas que leem a API JavaScript do compilador (typescript-eslint, ts-jest, Nest CLI) ainda não funcionam com o TypeScript 7 (compilador nativo). `packages/design-tokens` usa o TypeScript 7 instalado dentro do próprio pacote.
- Os pacotes `@nestjs/*` do Nest 12 são distribuídos só como ESM. O Jest (CommonJS) os carrega por meio de `apps/api/jest/esm-transformer.js`, e o client do Prisma é gerado em CommonJS (`moduleFormat = "cjs"`) em `apps/api/src/generated/prisma` (ignorado pelo git; recriado por `npx prisma generate` dentro de `apps/api`).
- A CLI do Nest 12 exige Node 22.22.3 ou mais novo; com versões anteriores do Node 22 ela falha ao iniciar. Por isso o workspace usa a CLI 11 (`@nestjs/cli@^11`), que compila o mesmo projeto. Ao atualizar o Node, é possível voltar para a CLI 12.

## Convenções da API

- Prefixo global `/api/v1`, porta 8000. Públicas (`@Public()`): `POST /auth/login`, `POST /auth/register-student`, `GET /health`. As demais exigem `Authorization: Bearer <token>`.
- Autenticação por `AuthGuard` global (`src/common/guards/auth.guard.ts`): resolve o Bearer pelo hash SHA-256 em `access_tokens` e rejeita usuário inativo (401 `Não autenticado.`). Como `common` não importa features, o guard depende do contrato `TOKEN_RESOLVER` (`src/shared/auth/auth-user.ts`), que o `AuthModule` implementa com o `TokenService`. Registrado como `APP_GUARD` no `AppModule` antes do `RolesGuard`; `@CurrentUser()` devolve o `AuthUser`. Validade dos tokens por canal (`access_tokens.channel`): web expira após 7 dias sem uso ou 30 dias desde o login; mobile após 30 dias sem uso ou 180 dias desde o login. Token expirado é apagado e responde 401; o `last_used_at` só é regravado se tiver mais de 60 s (uma falha nessa gravação só gera aviso no log). O `TokenService` lê a hora por um relógio injetável (`CLOCK`, `src/shared/clock/clock.ts`), trocado nos testes. Senhas com `bcryptjs` (custo 10); e-mail sempre normalizado (trim + minúsculas) e código de turma em maiúsculas.
- Autorização por `RolesGuard`, **negada por padrão**: toda rota não pública declara `@Roles(Role.Admin, Role.Teacher)` ou `@AnyAuthenticated()` (qualquer perfil logado, ex.: `GET /auth/me`); sem isso a resposta é 403. O teste `test/route-authorization.e2e-spec.ts` percorre todas as rotas do `AppModule` e falha se alguma não declarar. Regras de posse (professor só mexe no que é seu) ficam nos services.
- Erros em JSON `{ message, errors? }`, padronizados por um filtro global: 422 validação (`errors: { campo: [mensagens] }`), 401/403 autenticação/autorização, 404, 409 conflito de regra de negócio (`BusinessRuleException`), 500 sem detalhes internos. Mensagens em português do Brasil.
- Campos JSON (corpo, resposta e query string) sempre em `snake_case` (`join_code`, `created_at`).
- Datas e horas no banco como `TIMESTAMPTZ(3)` (`@db.Timestamptz(3)` em todo `DateTime` do schema; datas sem hora, como `last_study_date`, ficam `DATE`). Migrations que convertem colunas existentes usam `ALTER COLUMN … TYPE TIMESTAMPTZ(3) USING … AT TIME ZONE 'UTC'`.
- Paginação `{ data, meta: { page, per_page, total, last_page } }`, com `?page=` (≥ 1, padrão 1) e `?per_page=` (1–100, padrão 15): a rota recebe `@Query() query: PaginationQueryDto` e o service usa `toPrismaPage(query)` no `findMany` e `paginate(data, total, query)` na resposta (`src/shared/pagination/`).
- Documentação interativa em `http://localhost:8000/docs` (JSON em `/docs-json`). O plugin da CLI do `@nestjs/swagger` (`nest-cli.json`, com `classValidatorShim` e `introspectComments`) gera o schema dos DTOs a partir dos tipos, dos decorators do class-validator e dos comentários `/** … */` das propriedades, sem `@ApiProperty` manual. Vale para `nest start`/`nest build`; nos testes (ts-jest) o plugin não roda.

## Como subir o ambiente

Pré-requisitos: Docker Desktop, Node 22 (`.nvmrc`) e npm 10.

1. Banco: `npm run db:up` — sobe o `postgres:17-alpine` (`nivela_db`) na porta **5433**, com os bancos `nivela` e `nivela_test` (usuário/senha `nivela`/`nivela`).
2. Dependências: `npm install` na raiz.
3. API: copiar `apps/api/.env.example` para `apps/api/.env` e rodar, na raiz, `npm run dev:api` (http://localhost:8000/api/v1, Swagger em http://localhost:8000/docs). Antes da primeira execução, aplicar as migrations e criar o administrador: `npm run db:deploy -w apps/api` (`prisma migrate deploy`) e `npm run db:seed -w apps/api`; durante o desenvolvimento, migrations novas são criadas com `npm run db:migrate -w apps/api` (`prisma migrate dev`) (o seed cria o administrador a partir de `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` e pode ser repetido: se o e-mail já existe, nada muda).
4. Web: copiar `apps/web/.env.example` para `apps/web/.env` (`VITE_API_URL`; sem ela o app falha ao abrir com mensagem explicando o que copiar) e rodar `npm run dev:web` (http://localhost:5173). Testes: `npm run test -w apps/web` (Vitest + Testing Library + MSW).
5. Mobile: copiar `apps/mobile/.env.example` para `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`) e rodar `npm run dev:mobile` (Expo; abrir no emulador Android ou no Expo Go). No emulador Android o `localhost` da máquina é `10.0.2.2` (valor padrão do `.env.example`); em celular físico use o IP da máquina na rede (ex.: `http://192.168.0.10:8000/api/v1`), com celular e computador no mesmo Wi-Fi e o Firewall do Windows liberando a porta 8000. Testes: `npm run test -w apps/mobile` (jest-expo + Testing Library).
6. Parar o banco: `npm run db:down`. Os dados ficam em `docker/pgdata/` (ignorado pelo git).

Testes da API: `npm run test -w apps/api` (unitários) e `npm run test:e2e -w apps/api` (aplica as migrations no banco `nivela_test` com `prisma migrate deploy` via `scripts/test-db-migrate.js` e roda o Jest com supertest; o script se recusa a rodar se o `DATABASE_URL` de `.env.test` não terminar em `_test`). Entre os testes, as suítes e2e que gravam no banco chamam `resetDatabase(prisma)` (`test/helpers/reset-database.ts`), que faz `TRUNCATE … RESTART IDENTITY CASCADE` em todas as tabelas do schema `public` (exceto `_prisma_migrations`). Não usamos `prisma migrate reset`: o Prisma o bloqueia quando rodado por agentes de IA. O `postinstall` do workspace roda `prisma generate`, então `npm install`/`npm ci` na raiz já cria `src/generated`.

**Versões fixadas no workspace** (`overrides` do `package.json` raiz): `react`/`react-dom` em 19.3.0 (a versão que o Expo SDK 58 embute), para existir um único React entre web e mobile (`npm ls react` não pode mostrar duplicatas), e `jsdom` em 29.1.1 (o 31 exige um `undici` que não roda no Node 22.14). O `typescript` fica em `~6.0` na web, na API e no mobile (exigência do `typescript-eslint`/Nest).
