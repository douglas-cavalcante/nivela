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

> Em construção: as funcionalidades chegam ao longo do [plano de implementação](docs/superpowers/plans/). Hoje já funcionam o login (web e mobile), o cadastro do aluno com código de turma e o perfil com troca de senha.

## Pré-requisitos

- Docker Desktop (aberto antes de `npm run db:up`)
- Node 22 (`.nvmrc`) e npm 10. O Node 22.14 funciona: o workspace usa a CLI 11 do Nest, que compila o mesmo projeto (a CLI 12 pede Node 22.22.3 ou mais novo; detalhes em [docs/architecture.md](docs/architecture.md#notas-sobre-typescript-e-ferramentas-da-api)).

## Como rodar

Todos os comandos na raiz do repositório (Git Bash no Windows).

```bash
# 1. Dependências de todos os workspaces (também gera o client do Prisma)
npm install

# 2. Banco de dados: PostgreSQL 17 no Docker, porta 5433 (bancos nivela e nivela_test)
npm run db:up

# 3. Variáveis de ambiente de cada app
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Estrutura do banco (migrations) e administrador inicial
npm run db:deploy -w apps/api
npm run db:seed -w apps/api

# 5. Cada app em um terminal
npm run dev:api      # http://localhost:8000/api/v1 · Swagger em http://localhost:8000/docs
npm run dev:web      # http://localhost:5173
npm run dev:mobile   # Expo: emulador Android ou Expo Go
```

**Primeiro acesso:** entre no painel web com o administrador criado pelo seed, cujas credenciais vêm de `apps/api/.env.example`:

- e-mail: `admin@nivela.test`
- senha: `nivela123`

Troque a senha em **Perfil** no primeiro acesso.

**App no celular:** o `apps/mobile/.env` vem com `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1`, que é o `localhost` da máquina visto de dentro do **emulador Android**. Em um **celular físico** (Expo Go), use o IP da sua máquina na rede, por exemplo `http://192.168.0.10:8000/api/v1` (veja o IP com `ipconfig`), com celular e computador no mesmo Wi-Fi. No Windows, o **Firewall do Windows** precisa permitir conexões de entrada na porta **8000** (a API escuta em `0.0.0.0:8000`). Depois de mudar o `.env`, reinicie o Expo.

Se `VITE_API_URL` (web) ou `EXPO_PUBLIC_API_URL` (mobile) não estiver definida, o app falha logo ao abrir com uma mensagem dizendo qual `.env` copiar.

## Testes e outros comandos

- `npm run lint` e `npm test`: rodam em todos os workspaces.
- `npm run test:e2e -w apps/api`: aplica as migrations no banco `nivela_test` (`prisma migrate deploy`) e roda os testes e2e; entre os testes, as tabelas são esvaziadas (`TRUNCATE`). O banco não é recriado, e o script se recusa a rodar se o banco não terminar em `_test`.
  - Um `DATABASE_URL` exportado no terminal **prevalece** sobre o `apps/api/.env.test` (é assim que o CI aponta para o banco dele). A trava do `_test` protege o banco de desenvolvimento: se o `DATABASE_URL` exportado apontar para `nivela`, os e2e se recusam a rodar.
- `npm run db:migrate -w apps/api`: cria uma migration nova durante o desenvolvimento (`prisma migrate dev`).
- `npm run db:down`: para o banco (os dados ficam em `docker/pgdata/`).
- Os mesmos passos do CI, localmente: `npm ci && npm run lint && npm test && npm run test:e2e -w apps/api`.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Estrutura de pastas](docs/estruturaDePastas.md)
- [Fluxo de trabalho (git e commits)](docs/workflow.md)
- [Especificação de design](docs/superpowers/specs/2026-11-08-nivela-design.md)
