# Nivela

Plataforma open source de apoio ao **nivelamento estudantil** na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada (moedas, sequência de estudo e loja de prêmios).

Trabalho de Conclusão de Curso — **Henrique Douglas Cavalcante Costa**.

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/api` | API Laravel 12 + PostgreSQL |
| `apps/web` | Painel web (React + Vite) para professor/admin |
| `apps/mobile` | App mobile (Expo) para o aluno |
| `packages/design-tokens` | Tokens de design compartilhados |
| `docs/` | Documentação e especificação |

> Em construção: os apps são criados ao longo do [plano de implementação](docs/superpowers/plans/). Os passos abaixo valem à medida que cada app existir.

## Pré-requisitos

- Docker Desktop
- PHP 8.2+ (com extensão `pdo_pgsql`) e Composer 2
- Node 22 (veja `.nvmrc`) e npm 10

## Como rodar

```bash
# 1. Dependências JS (raiz)
npm install

# 2. Banco de dados (PostgreSQL 17 na porta 5433)
npm run db:up

# 3. API (http://localhost:8000/api/v1)
cd apps/api && composer install && cp .env.example .env && php artisan key:generate && php artisan migrate --seed && cd ../..
npm run dev:api

# 4. Painel web (em outro terminal)
npm run dev:web

# 5. App mobile (em outro terminal)
npm run dev:mobile
```

Outros comandos: `npm run db:down`, `npm run lint`, `npm run test`.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Estrutura de pastas](docs/estruturaDePastas.md)
- [Fluxo de trabalho (git e commits)](docs/workflow.md)
- [Especificação de design](docs/superpowers/specs/2026-11-08-nivela-design.md)
