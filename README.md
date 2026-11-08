# Nivela

Plataforma open source de apoio ao **nivelamento estudantil** na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada (moedas, sequência de estudo e loja de prêmios).

Trabalho de Conclusão de Curso — **Henrique Douglas Cavalcante Costa**.

Integração contínua: [workflow de CI](.github/workflows/ci.yml) (lint, tipos, testes e build em todo push e pull request; detalhes em [docs/workflow.md](docs/workflow.md)).

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/api` | API NestJS 12 + Prisma 7 + PostgreSQL |
| `apps/web` | Painel web (React + Vite) para professor/admin |
| `apps/mobile` | App mobile (Expo) para o aluno |
| `packages/design-tokens` | Tokens de design compartilhados |
| `docs/` | Documentação e especificação |

> Em construção: os apps são criados ao longo do [plano de implementação](docs/superpowers/plans/). Os passos abaixo valem à medida que cada app existir.

## Pré-requisitos

- Docker Desktop
- Node 22 (veja `.nvmrc`; a CLI do Nest 12 pede 22.22.3 ou mais novo) e npm 10

## Como rodar

```bash
# 1. Dependências (raiz, todos os workspaces)
npm install

# 2. Banco de dados (PostgreSQL 17 na porta 5433)
npm run db:up

# 3. API (http://localhost:8000/api/v1, documentação em http://localhost:8000/docs)
cp apps/api/.env.example apps/api/.env
npm run dev:api

# 4. Painel web (em outro terminal)
npm run dev:web

# 5. App mobile (em outro terminal): copie apps/mobile/.env.example para apps/mobile/.env
#    Emulador Android: EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1 (padrão)
#    Celular físico: use o IP da sua máquina na rede, ex.: http://192.168.0.10:8000/api/v1
npm run dev:mobile
```

Outros comandos: `npm run db:down`, `npm run lint`, `npm run test`. Os mesmos passos do CI, localmente: `npm ci && npm run lint && npm test && npm run test:e2e -w apps/api`. Na API: `npm run test:e2e -w apps/api` (recria o banco `nivela_test` e roda os testes e2e) e `npm run db:migrate -w apps/api`.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Estrutura de pastas](docs/estruturaDePastas.md)
- [Fluxo de trabalho (git e commits)](docs/workflow.md)
- [Especificação de design](docs/superpowers/specs/2026-11-08-nivela-design.md)
