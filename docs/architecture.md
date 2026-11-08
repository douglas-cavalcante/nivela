# Arquitetura do Nivela

O **Nivela** é uma plataforma open source de apoio ao nivelamento estudantil na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada.

## Visão geral

```
Professor/Admin ──► apps/web (React + MUI) ─┐
                                            ├─ HTTPS/JSON · Bearer token ─► apps/api (NestJS 12) ─► PostgreSQL 17
Aluno ───────────► apps/mobile (Expo)  ─────┘
packages/design-tokens ──► consumido por web e mobile
```

- A **API** concentra toda a regra de negócio e é a única a acessar o banco.
- **Web** (professor/admin) e **mobile** (aluno) são clientes da mesma API REST em `/api/v1`.
- O login informa o canal (`web` ou `mobile`) e a API valida o perfil do canal.
- O pacote `design-tokens` garante a mesma identidade visual ("Caderno Vivo") nos dois clientes.

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
- Autorização por `RolesGuard` + `@Roles(Role.Admin, Role.Teacher)`; regras de posse (professor só mexe no que é seu) nos services.
- Erros em JSON `{ message, errors? }`, padronizados por um filtro global: 422 validação (`errors: { campo: [mensagens] }`), 401/403 autenticação/autorização, 404, 409 conflito de regra de negócio (`BusinessRuleException`), 500 sem detalhes internos. Mensagens em português do Brasil.
- Paginação `{ data, meta: { page, perPage, total, lastPage } }`, 15 por página.
- Documentação interativa em `http://localhost:8000/docs`.

## Como subir o ambiente

Pré-requisitos: Docker Desktop, Node 22 (`.nvmrc`) e npm 10.

1. Banco: `npm run db:up` — sobe o `postgres:17-alpine` (`nivela_db`) na porta **5433**, com os bancos `nivela` e `nivela_test` (usuário/senha `nivela`/`nivela`).
2. Dependências: `npm install` na raiz.
3. API: copiar `apps/api/.env.example` para `apps/api/.env` e rodar, na raiz, `npm run dev:api` (http://localhost:8000/api/v1, Swagger em http://localhost:8000/docs). Migrations e seed: `npm run db:migrate -w apps/api` e `npm run db:seed -w apps/api`.
4. Web: `npm run dev:web`.
5. Mobile: `npm run dev:mobile` (Expo; abrir no Expo Go ou emulador).
6. Parar o banco: `npm run db:down`. Os dados ficam em `docker/pgdata/` (ignorado pelo git).

Testes da API: `npm run test -w apps/api` (unitários) e `npm run test:e2e -w apps/api` (recria o banco `nivela_test` com `prisma migrate reset` e roda o Jest com supertest; o script se recusa a rodar se `DATABASE_URL` de `.env.test` não terminar em `_test`).

> `apps/web` e `apps/mobile` são criados nas tarefas seguintes do plano de implementação; os passos 4 e 5 só funcionam depois disso.
