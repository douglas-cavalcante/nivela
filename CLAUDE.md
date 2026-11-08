# CLAUDE.md

Nivela: monorepo de uma plataforma de nivelamento estudantil (API NestJS + painel web React + app mobile Expo). Documentação e textos de interface em português do Brasil.

## Docs

A pasta [docs/](docs/) reúne a documentação de referência do projeto. Consulte o guia relevante antes de implementar:

- [docs/estruturaDePastas.md](docs/estruturaDePastas.md) — organização por features nos três apps e regras de import. Leia antes de criar ou mover arquivos: imports que saem da pasta usam `src/...` (nunca `../`), uma feature só usa outra pelo módulo/service dela (API) ou pelo `index.ts` (web/mobile), e código compartilhado não importa de features. Rode `npm run lint` para verificar.
- [docs/architecture.md](docs/architecture.md) — stack com versões e motivos, diagrama da arquitetura, convenções da API e como subir o ambiente (`npm run db:up`, API, web, mobile).
- [docs/workflow.md](docs/workflow.md) — gitflow, padrão de commits (Conventional Commits em português com escopo, com o trailer `Co-Authored-By`) e definição de pronto. Leia antes de criar branch ou commitar.
- [docs/superpowers/specs/2026-11-08-nivela-design.md](docs/superpowers/specs/2026-11-08-nivela-design.md) — especificação de design completa (perfis, arquitetura, modelo de dados, regras de negócio RN01–RN15, testes).

## Regras rápidas

- TypeScript estrito, sem `any` explícito; cores só via tokens de `packages/design-tokens`.
- Mensagens de erro da API e textos de interface em português do Brasil.
- Rode `npm run lint` e `npm run test` antes de concluir uma tarefa. Nada de `git push` sem autorização.
