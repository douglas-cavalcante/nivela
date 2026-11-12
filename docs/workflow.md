# Fluxo de Trabalho

## Gitflow

- `main` — versões estáveis, cada uma com tag (`v1.0.0`).
- `develop` — branch de integração.
- `feature/<nome>` — uma branch por feature, criada a partir de `develop` atualizado e integrada de volta com `git merge --no-ff`; depois a branch é apagada (`git branch -d`).
- `release/1.0.0` — sai de `develop`, é integrada em `main` com tag `v1.0.0` e volta para `develop`.

**Versões:** cada versão segue `release/x.y.z` → `main` (`git merge --no-ff release/x.y.z`) + tag assinada `vx.y.z` (`git tag -s`) → de volta para `develop` (`--no-ff`). A branch da release traz só o aumento de versão nos `package.json`, o `CHANGELOG.md` e correções finais.

Passo a passo de uma feature:

```bash
git checkout develop
git checkout -b feature/<nome>
# ... commits pequenos ...
git checkout develop
git merge --no-ff feature/<nome>
git branch -d feature/<nome>
```

**Ordem das features:** `monorepo-setup` → `design-tokens` → `api-foundation` → `web-foundation` → `mobile-foundation` → `auth` → `teachers` → `subjects-categories` → `questions` → `classrooms` → `answers` → `leveling-plans` → `rewards-store` → `dashboard-reports` → `seed-demo` → `tcc-docs` → `release/1.0.0`.

Publicação no GitHub (repositório público) apenas com autorização explícita do autor; nada de `git push` sem ela.

## Commits

- **Conventional Commits em português**, com escopo do app quando houver: `feat(api): …`, `fix(web): …`, `test(mobile): …`, `chore: …`, `docs: …`.
- Tipos usados: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Commits pequenos, um por passo lógico (um assunto por commit).
- Commits saem só no nome do autor, assinados via SSH, **sem** linha `Co-Authored-By`.
- Commits e tags **assinados via SSH**, com o autor configurado no repositório. Datas reais (sem retroagir).

## Definição de pronto

Uma feature está pronta quando:

1. os testes da feature passam (API: Jest; web: Vitest; mobile: jest-expo);
2. lint e checagem de tipos estão limpos (`npm run lint` e `npm run typecheck`, na raiz ou em cada workspace);
3. a documentação foi atualizada quando a feature muda a estrutura (`docs/estruturaDePastas.md`, `docs/architecture.md`).

## Testes e CI

- **API (Jest + supertest):** testes unitários dos services (`*.spec.ts`, Prisma mockado) e e2e por feature (`test/*.e2e-spec.ts`, banco `nivela_test`) cobrindo sucesso, validação e permissão; testes dedicados às regras de negócio; ESLint com as regras de dependência entre features; Prettier.
- **Web (Vitest + MSW)** e **Mobile (jest-expo)**: testes das telas e fluxos principais.
- **CI** (`.github/workflows/ci.yml`, GitHub Actions): roda em `push` para `develop`/`main` e em todo `pull_request`; uma execução nova da mesma branch cancela a anterior. Cada job usa Node 22 e `npm ci` na raiz:
  - `api`: serviço `postgres:17-alpine` (banco `nivela_test`, porta 5432, `DATABASE_URL` definido no job e prevalecendo sobre o `apps/api/.env.test`), com `lint`, `typecheck`, `test` (unitários), `test:e2e` (aplica `prisma migrate deploy` e roda os e2e) e `build`;
  - `web`: `typecheck` e `test` de `packages/design-tokens`, depois `lint`, `typecheck`, `test` e `build` do `apps/web`;
  - `contract`: `typecheck` e `test` de `packages/api-contract`;
  - `mobile`: `lint`, `typecheck` e `test` do `apps/mobile`.
  Para reproduzir localmente: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build`. O selo do CI no README é adicionado depois do primeiro push, quando o repositório no GitHub existir.
- Na raiz: `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` rodam os scripts de todos os workspaces que os têm (`--if-present`).
