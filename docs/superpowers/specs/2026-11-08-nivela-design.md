# Nivela — Especificação de Design

- **Data:** 2026-11-08
- **Autor:** Henrique Douglas Cavalcante Costa
- **Origem:** documento do TCC "Desenvolvimento de um sistema para apoio ao nivelamento estudantil" (set/2024) + sessões de brainstorming
- **Status:** aguardando revisão

---

## 1. Contexto e objetivo

Após a pandemia, 7 em cada 10 alunos do Ensino Médio apresentam nível insuficiente em Língua Portuguesa e Matemática, o que afeta a preparação para ENEM, SPAECE e olimpíadas. O **Nivela** é uma plataforma **open source** para apoiar o nivelamento de estudantes na transição do Fundamental II para o Ensino Médio: professores cadastram questões e montam planos de nivelamento; alunos estudam pelo celular de forma gamificada.

**Critérios de sucesso**

1. Os três apps (API, painel web, app mobile) rodam localmente com um comando cada e se integram de ponta a ponta.
2. Todas as funcionalidades do item 2.2 do documento do TCC estão implementadas (seção 5 desta spec).
3. Regras de negócio críticas (moedas, resgate, desbloqueio, permissões) cobertas por testes automatizados.
4. Repositório organizado em gitflow, commits assinados, CI verde, documentação suficiente para escrever o capítulo "Desenvolvimento" do artigo (UML, arquitetura, prints).

**Fora do escopo (v1.0.0)**: avaliação diagnóstica automática, notificações push, itens virtuais na loja, publicação nas lojas de apps, deploy em produção, chat professor–aluno, recuperação de senha por e-mail.

---

## 2. Perfis de usuário

| Perfil | Onde usa | Pode |
|---|---|---|
| `admin` | Web | Tudo que o professor faz, sobre **todos** os dados; cadastrar/desativar professores |
| `teacher` | Web | Gerenciar disciplinas, categorias, questões (edita só as próprias), **suas** turmas e alunos, planos, prêmios e resgates |
| `student` | Mobile | Cadastrar-se com código de turma, responder questões, seguir planos, resgatar prêmios |

- O admin inicial é criado por seeder (credenciais em `.env.example`, trocadas no primeiro uso).
- Aluno **não** acessa o painel web; professor/admin **não** acessam o app (a API recusa o login fora do canal certo com mensagem clara).

---

## 3. Arquitetura

```
Professor/Admin ──► apps/web (React + MUI) ─┐
                                            ├─ HTTPS/JSON · Bearer token (Sanctum) ─► apps/api (Laravel 12) ─► PostgreSQL 17
Aluno ───────────► apps/mobile (Expo)  ─────┘
packages/design-tokens ──► consumido por web e mobile
```

### 3.1 Monorepo

```
tcc/
├── apps/
│   ├── api/                # Laravel 12 (Composer, fora dos workspaces npm)
│   ├── web/                # React + Vite + TS
│   └── mobile/             # Expo + Expo Router + TS
├── packages/
│   └── design-tokens/      # @nivela/design-tokens (TS puro)
├── docs/                   # arquitetura, estrutura de pastas, workflow, requisitos, UML, prints
├── docker-compose.yml      # postgres:17-alpine
├── package.json            # npm workspaces: apps/web, apps/mobile, packages/*
├── .github/workflows/ci.yml
└── CLAUDE.md               # aponta para docs/
```

Scripts na raiz: `db:up`, `db:down`, `dev:api`, `dev:web`, `dev:mobile`, `lint`, `test`.

### 3.2 API — `apps/api`

- **Laravel 12**, PHP 8.2+, PostgreSQL 17 (Docker, porta host 5433).
- **Autenticação:** Laravel Sanctum com *personal access tokens* (Bearer) para web e mobile. Login informa o canal (`web` | `mobile`) e a API valida o perfil do canal.
- **Rotas:** prefixo `/api/v1`. Públicas: `POST /auth/login`, `POST /auth/register-student`, `GET /health`. Demais exigem `auth:sanctum`.
- **Autorização:** middleware de perfil (`role:admin,teacher`) + *Policies* por model (ex.: professor só edita a própria questão e as próprias turmas).
- **Organização por feature** (mesmos nomes da web e do mobile):

```
app/
├── Modules/
│   └── <Feature>/                 # ex.: Questions
│       ├── Controllers/           # finos: validam via Request, delegam ao Service, devolvem Resource
│       ├── Requests/              # FormRequest (validação + mensagens em pt-BR)
│       ├── Resources/             # formato do JSON de saída
│       ├── Models/
│       ├── Policies/
│       ├── Services/              # regra de negócio, transações
│       └── routes.php             # rotas da feature, carregadas pelo RouteServiceProvider
├── Shared/                        # código usado por mais de uma feature (ex.: CoinLedger, enums)
└── Support/                       # helpers sem regra de negócio
```

  Features: `Auth`, `Users` (professores/admin), `Classrooms`, `Students`, `Subjects`, `Categories`, `Questions`, `Answers`, `LevelingPlans`, `Rewards`, `Dashboard`.
- **Regras de dependência (Pest arch tests):** uma feature não usa classes internas de outra, exceto Models e Services expostos; `Shared` e `Support` não dependem de `Modules`; controllers não usam `DB::` direto.
- **Erros:** JSON padronizado `{ message, errors? }`; 422 validação, 401/403 auth, 404, 409 conflito de regra (ex.: saldo insuficiente, estoque zerado).
- **Paginação:** padrão Laravel (`data`, `meta`, `links`), 15 por página.
- **Upload de imagens** (questões, prêmios): disco `public`, validação de tipo/tamanho (jpg/png/webp, até 2 MB).
- **Documentação da API:** Scribe em `/docs`.
- **Testes:** Pest (feature tests com banco PostgreSQL de teste via `RefreshDatabase`), Pint para formatação.

### 3.3 Web — `apps/web` (professor/admin)

- Vite, React 19, TypeScript estrito, **Material UI v7**, React Router 7, Axios, react-hook-form + zod, Recharts.
- Estrutura por feature (modelo do projeto Estagius / bulletproof-react):

```
src/
├── app/          # App.tsx, rotas, layouts (AppLayout com sidebar "fichário", AuthLayout)
├── features/<feature>/
│   ├── api/      # <recurso>.api.ts (retorna resposta do axios) e <recurso>.action.ts (retorna data)
│   ├── components/ pages/<Tela>/index.tsx  schemas/  types/  utils/
│   └── index.ts  # API pública da feature
├── components/   # UI genérica (PageHeader, DataTable, ConfirmDialog, EmptyState com o mascote…)
├── lib/          # axios (interceptor de token e 401), AuthContext, theme (MUI a partir dos design tokens)
├── hooks/ utils/ constants/ types/ assets/ styles/
```

- **Regras de import (ESLint):** alias `src/` (nunca `../` saindo da pasta); feature usa outra só pelo `index.ts`; código compartilhado não importa de features nem de `app`; `axios` só em `features/*/api` e `lib/`; sem `any` explícito; nada de cor hex fora do tema (sempre tokens).
- Testes: Vitest + Testing Library + MSW.

### 3.4 Mobile — `apps/mobile` (aluno)

- Expo (SDK estável mais recente), **Expo Router**, TypeScript estrito, Axios, `expo-secure-store` (token), `react-native-reanimated` (microanimações), `react-native-svg` (mascote), fontes Caveat + Nunito (`@expo-google-fonts`).
- Rotas em `app/` (Expo Router): `(auth)/welcome`, `(auth)/login`, `(auth)/register`, `(tabs)/index`, `(tabs)/study`, `(tabs)/store`, `(tabs)/profile`, `plans/[id]`, `questions/[id]`.
- Lógica em `src/features/<feature>/` com a mesma anatomia e as mesmas regras de import da web.
- Testes: jest-expo + Testing Library.

### 3.5 Design tokens — `packages/design-tokens`

Exporta em TypeScript: paleta (claro/escuro), tipografia, raios, espaçamentos, sombras "recortadas". A web gera o tema MUI a partir dele; o mobile, um `ThemeProvider` próprio.

---

## 4. Identidade visual — "Caderno Vivo"

| Token | Claro | Uso |
|---|---|---|
| `ink` | `#23313F` | texto principal, bordas "de caneta", sidebar |
| `teal` | `#1FB5A6` | ação primária, Matemática |
| `coral` | `#FF7A59` | destaque, Português, progresso |
| `highlighter` | `#FFD86B` | marca-texto, item ativo |
| `paper` | `#FFFDF6` | fundo (com pauta `#E6EEF5`) |

- Tema escuro "papel noturno" (fundo azul-tinta, pauta sutil, mesmas cores de destaque com contraste ajustado).
- Títulos em **Caveat** (manuscrita), texto em **Nunito**.
- Cards com borda de 2 px em `ink` e sombra deslocada sólida (`3px 3px 0 ink`); palavras-chave sublinhadas com marca-texto.
- **Mascote "Rabisco"**: lápis original em SVG, usado em onboarding, estados vazios e feedback.
- **Microanimações**: marca-texto ao acertar, página virando ao abrir capítulo, moedas voando até o contador.
- **Acessibilidade**: contraste WCAG AA verificado nos tokens, alvos de toque ≥ 44 px, suporte a fonte dinâmica no mobile, foco visível na web.
- **Web**: layout com **sidebar "fichário"** à esquerda (item ativo vira folha clara com sombra amarela).

---

## 5. Funcionalidades

### 5.1 Painel web

| Menu | Funcionalidades | Perfis |
|---|---|---|
| Início | cards (alunos ativos, questões, taxa de acerto, alunos com acerto < 50%), questões recentes, resgates pendentes | teacher, admin |
| Questões | listagem com filtros (disciplina, categoria, dificuldade, busca) e paginação; formulário (enunciado, imagem, 5 alternativas com 1 correta, explicação, dificuldade); ativar/desativar | teacher, admin |
| Disciplinas | listagem e formulário (nome, cor, ícone) | teacher, admin |
| Categorias | listagem por disciplina e formulário | teacher, admin |
| Turmas | criar/editar; código de entrada (copiar, regenerar); alunos da turma; cadastro manual de aluno; desempenho por categoria | teacher (próprias), admin |
| Alunos | listagem; ficha (desempenho por categoria, planos e progresso, extrato de moedas) | teacher (alunos das suas turmas), admin |
| Planos | criar plano (título, descrição, disciplina, bônus); capítulos ordenáveis; selecionar questões do banco; publicar; atribuir a turma ou aluno com prazo opcional; acompanhar progresso | teacher (próprios), admin |
| Loja de prêmios | cadastro de prêmios (nome, descrição, foto, preço, estoque, ativo); fila de resgates com entregar / recusar (motivo obrigatório) | teacher, admin |
| Professores | cadastrar, editar, desativar | admin |
| Perfil | trocar senha, alternar tema claro/escuro, sair | todos |

### 5.2 App mobile (aluno)

| Tela | Funcionalidades |
|---|---|
| Boas-vindas | apresentação com o mascote; "Entrar" ou "Tenho um código de turma" |
| Cadastro | nome, e-mail, senha, código da turma (validado na API) |
| Login | e-mail e senha |
| Início | saudação, sequência 🔥, moedas 🪙, "Meus planos" com progresso |
| Plano | capítulos em ordem com cadeado/progresso |
| Questão | enunciado, imagem, alternativas A–E, responder |
| Feedback | acerto: animação + moedas + explicação; erro na 1ª: tentar de novo; erro na 2ª: alternativa correta + explicação |
| Estudar | prática livre por disciplina/categoria |
| Loja | vitrine (preço, estoque), resgatar com confirmação, "Meus resgates" com status |
| Perfil | dados, turmas, entrar em outra turma por código, extrato de moedas, melhor sequência, sair |

---

## 6. Modelo de dados

| Tabela | Colunas principais |
|---|---|
| `users` | id, name, email (único), password, role (`admin`/`teacher`/`student`), active, timestamps |
| `student_profiles` | user_id (PK/FK), coins_balance, current_streak, best_streak, last_study_date |
| `personal_access_tokens` | (Sanctum) |
| `classrooms` | id, teacher_id → users, name, school_year, join_code (único), active, timestamps |
| `classroom_student` | classroom_id, student_id, joined_at — PK composta |
| `subjects` | id, name (único), color, icon |
| `categories` | id, subject_id, name — único por disciplina |
| `questions` | id, author_id, subject_id, category_id, statement, image_path?, difficulty (`easy`/`medium`/`hard`), explanation, active, timestamps |
| `question_options` | id, question_id, letter (A–E), text, is_correct |
| `leveling_plans` | id, teacher_id, subject_id, title, description, completion_bonus, status (`draft`/`published`), timestamps |
| `plan_chapters` | id, leveling_plan_id, title, position |
| `chapter_question` | plan_chapter_id, question_id, position — PK composta |
| `plan_assignments` | id, leveling_plan_id, classroom_id?, student_id?, due_date? — exatamente um de classroom/student (CHECK) |
| `chapter_completions` | student_id, plan_chapter_id, completed_at — PK composta |
| `plan_completions` | student_id, leveling_plan_id, completed_at, bonus_awarded — PK composta |
| `question_attempts` | id, student_id, question_id, plan_chapter_id?, selected_option_id, attempt_number (1/2), is_correct, coins_awarded, created_at |
| `coin_transactions` | id, student_id, amount (±), reason (`correct_answer`/`plan_completed`/`streak_bonus`/`redemption`/`refund`), source_type, source_id, created_at |
| `rewards` | id, created_by, name, description, image_path?, price, stock, active, timestamps |
| `reward_redemptions` | id, reward_id, student_id, price_paid, status (`pending`/`delivered`/`rejected`), handled_by?, handled_at?, rejection_reason?, timestamps |

Índices em todas as FKs e em `questions(subject_id, category_id, active)`, `question_attempts(student_id, question_id)`, `reward_redemptions(status)`.

---

## 7. Regras de negócio

| Código | Regra |
|---|---|
| RN01 | Toda questão tem exatamente 5 alternativas (A–E) e exatamente 1 correta. |
| RN02 | Só o autor ou o admin edita uma questão. Questão com tentativas registradas não é excluída, só desativada. Questões inativas não aparecem para alunos. |
| RN03 | O aluno tem no máximo 2 tentativas por questão **por contexto** (capítulo de plano ou prática livre). |
| RN04 | Moedas por acerto: 10 na 1ª tentativa, 5 na 2ª. O aluno só ganha moedas na **primeira vez** que acerta cada questão (em qualquer contexto). |
| RN05 | A alternativa correta e a explicação só são enviadas ao app **depois** da resposta (acerto ou 2ª tentativa errada). |
| RN06 | Um capítulo é concluído quando todas as suas questões foram acertadas ou tiveram as 2 tentativas esgotadas. O capítulo N+1 só libera após concluir o N. |
| RN07 | Ao concluir o último capítulo, o plano é concluído e o aluno recebe `completion_bonus` uma única vez. |
| RN08 | Plano só pode ser atribuído depois de publicado; plano publicado com progresso de alunos não pode ter capítulos/questões removidos. |
| RN09 | Sequência: responder ≥ 1 questão num dia (fuso America/Fortaleza) mantém/incrementa o streak; pular um dia zera. A cada 7 dias consecutivos, +20 moedas. |
| RN10 | Toda movimentação de moedas gera linha em `coin_transactions` e atualiza `coins_balance` na mesma transação do banco. Saldo nunca fica negativo. |
| RN11 | Resgate: exige prêmio ativo, estoque > 0 e saldo ≥ preço. Débito, baixa de estoque e criação do pedido `pending` ocorrem numa única transação com `SELECT … FOR UPDATE`. |
| RN12 | Resgate `pending` pode virar `delivered` ou `rejected` (motivo obrigatório). `rejected` devolve as moedas (`refund`) e o estoque. Estados finais não mudam. |
| RN13 | Código de turma: formato `NIV-XXXX` (letras/números sem caracteres ambíguos), único; o professor pode regenerá-lo; turmas inativas não aceitam novos alunos. |
| RN14 | E-mail único no sistema. Usuário inativo não faz login. Senha mínima de 8 caracteres. |
| RN15 | Professor só vê/gerencia as próprias turmas, os alunos delas e os próprios planos; admin vê tudo. |

---

## 8. Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Senhas com hash bcrypt; tokens revogados no logout. |
| RNF02 | Respostas da API em JSON, mensagens de erro em português. |
| RNF03 | Interface responsiva na web (≥ 1024 px confortável, utilizável em tablet). |
| RNF04 | App compatível com Android (alvo principal) e iOS via Expo. |
| RNF05 | Contraste WCAG AA, alvos de toque ≥ 44 px. |
| RNF06 | Código aberto no GitHub com README de instalação. |
| RNF07 | CI executa lint, checagem de tipos, testes e build em cada push/PR. |

---

## 9. Testes e qualidade

- **API (Pest)**: um arquivo de teste por feature cobrindo sucesso, validação e permissão; testes dedicados às RN03–RN12 (incluindo resgate concorrente e reembolso); arch tests das regras de dependência; Pint.
- **Web (Vitest + MSW)**: login, formulário de questões (validação de 1 correta), montagem de plano, fila de resgates.
- **Mobile (jest-expo)**: tela de questão + feedback (acerto, erro 1ª, erro 2ª), resgate na loja.
- **CI** (`.github/workflows/ci.yml`): jobs `api` (serviço PostgreSQL, composer, pint --test, pest), `web` (lint, tsc, vitest, build), `mobile` (lint, tsc, jest).
- **Definição de pronto**: testes da feature passando, lint e tipos limpos, docs atualizadas quando a feature muda estrutura.

---

## 10. Git e entrega

- Configuração local do repositório: autor `Henrique Douglas <henriquedouglas2803@gmail.com>`, commits e tags **assinados via SSH** (`~/.ssh/id_ed25519`). Datas reais (sem retroagir).
- **Gitflow**: `main` (versões com tag) · `develop` (integração) · `feature/<nome>` a partir de `develop`, integrada com `merge --no-ff` · `release/1.0.0` → `main` + tag `v1.0.0` → `develop`.
- **Commits**: Conventional Commits em português com escopo do app (`feat(api): …`, `test(web): …`, `docs: …`), pequenos e por passo lógico.
- **Ordem das features**: `monorepo-setup` → `design-tokens` → `api-foundation` → `web-foundation` → `mobile-foundation` → `auth` → `teachers` → `subjects-categories` → `questions` → `classrooms` → `answers` → `leveling-plans` → `rewards-store` → `dashboard-reports` → `seed-demo` → `tcc-docs` → `release/1.0.0`.
- Publicação no GitHub (repositório público em `douglas-cavalcante`) apenas com autorização explícita.

---

## 11. Material para o artigo (docs/)

- `docs/requisitos.md` — RF, RNF e RN (desta spec, numerados).
- `docs/uml/` — diagrama de casos de uso, diagrama de classes, DER (fontes Mermaid/PlantUML + PNG exportado).
- `docs/architecture.md` — arquitetura, tecnologias, requisitos de implantação.
- `docs/prints/` — capturas das principais telas da web e do app (tema claro).
- `docs/estruturaDePastas.md`, `docs/workflow.md` — organização e gitflow.
