# Arquitetura do Nivela

O **Nivela** é uma plataforma open source de apoio ao nivelamento estudantil na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada.

## Visão geral

```
Professor/Admin ──► apps/web (React + MUI) ─┐
                                            ├─ HTTPS/JSON · Bearer token (Sanctum) ─► apps/api (Laravel 12) ─► PostgreSQL 17
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
| API | Laravel 12, PHP 8.2+ | Laravel 12 tem suporte de segurança até fev/2027; o Laravel 13 exige PHP 8.3, mais novo que o PHP 8.2 do ambiente de desenvolvimento |
| Autenticação | Laravel Sanctum (personal access tokens) | Um mesmo token Bearer atende web e mobile; revogável no logout |
| Banco | PostgreSQL 17 (Docker, porta host 5433) | Transações e `SELECT … FOR UPDATE` para moedas e resgates |
| Testes da API | Pest 3 + Pint | Pest 4/5 exigem PHP 8.3/8.4 |
| Documentação da API | Scribe (`/docs`) | Gerada a partir do código |
| Web | Vite, React 19, TypeScript estrito, Material UI, React Router, Axios, react-hook-form + zod, Recharts | Painel administrativo com formulários e gráficos |
| Testes da web | Vitest + Testing Library + MSW | Testes de integração sem backend real |
| Mobile | Expo (SDK 58), Expo Router, TypeScript estrito, Axios, expo-secure-store, Reanimated, react-native-svg | Android como alvo principal e iOS via Expo |
| Testes do mobile | jest-expo + Testing Library | Testes de tela e fluxo no padrão do Expo |
| Monorepo | npm workspaces (`apps/web`, `apps/mobile`, `packages/*`) | A API usa Composer e fica fora dos workspaces |
| CI | GitHub Actions | Lint, tipos, testes e build a cada push/PR |

A organização interna de cada app está em [estruturaDePastas.md](estruturaDePastas.md).

## Convenções da API

- Prefixo `/api/v1`. Públicas: `POST /auth/login`, `POST /auth/register-student`, `GET /health`. As demais exigem `auth:sanctum`.
- Autorização por middleware de perfil (`role:admin,teacher`) e Policies por model.
- Erros em JSON `{ message, errors? }`: 422 validação, 401/403 autenticação/autorização, 404, 409 conflito de regra de negócio. Mensagens em português do Brasil.
- Paginação padrão do Laravel (`data`, `meta`, `links`), 15 por página.

## Como subir o ambiente

Pré-requisitos: Docker Desktop, PHP 8.2+ com `pdo_pgsql`, Composer 2, Node 22 (`.nvmrc`) e npm 10.

1. Banco: `npm run db:up` — sobe o `postgres:17-alpine` (`nivela_db`) na porta **5433**, com os bancos `nivela` e `nivela_test` (usuário/senha `nivela`/`nivela`).
2. Dependências JS: `npm install` na raiz.
3. API: `cd apps/api && composer install`, copiar `.env.example` para `.env`, `php artisan key:generate`, `php artisan migrate --seed`; depois, na raiz, `npm run dev:api` (http://localhost:8000/api/v1).
4. Web: `npm run dev:web`.
5. Mobile: `npm run dev:mobile` (Expo; abrir no Expo Go ou emulador).
6. Parar o banco: `npm run db:down`. Os dados ficam em `docker/pgdata/` (ignorado pelo git).

> `apps/api`, `apps/web`, `apps/mobile` e `packages/design-tokens` são criados nas tarefas seguintes do plano de implementação; os passos 3 a 5 só funcionam depois disso.
