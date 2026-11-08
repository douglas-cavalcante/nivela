# Fluxo de Trabalho

## Gitflow

- `main` — versões estáveis, cada uma com tag (`v1.0.0`).
- `develop` — branch de integração.
- `feature/<nome>` — uma branch por feature, criada a partir de `develop` atualizado e integrada de volta com `git merge --no-ff`; depois a branch é apagada (`git branch -d`).
- `release/1.0.0` — sai de `develop`, é integrada em `main` com tag `v1.0.0` e volta para `develop`.

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
- Commits e tags **assinados via SSH**, com o autor configurado no repositório. Datas reais (sem retroagir).

## Definição de pronto

Uma feature está pronta quando:

1. os testes da feature passam (API: Pest; web: Vitest; mobile: jest-expo);
2. lint e checagem de tipos estão limpos (`npm run lint`, Pint e `tsc`);
3. a documentação foi atualizada quando a feature muda a estrutura (`docs/estruturaDePastas.md`, `docs/architecture.md`).

## Testes e CI

- **API (Pest):** um arquivo de teste por feature cobrindo sucesso, validação e permissão; testes dedicados às regras de negócio; arch tests das regras de dependência; Pint.
- **Web (Vitest + MSW)** e **Mobile (jest-expo)**: testes das telas e fluxos principais.
- **CI** (`.github/workflows/ci.yml`): jobs `api` (serviço PostgreSQL, composer, `pint --test`, pest), `web` (lint, tsc, vitest, build) e `mobile` (lint, tsc, jest).
- Na raiz: `npm run lint` e `npm run test` rodam os scripts de todos os workspaces.
