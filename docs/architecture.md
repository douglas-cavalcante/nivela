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
- O pacote `api-contract` (`@nivela/api-contract`, TS puro, sem build) é a fonte única dos **tipos de resposta da API** (`ApiUser`, `Role`, `Paginated`, `ErrorBody`, `ApiClassroom`, `ApiQuestion`, `ApiStudent`...) e do `parseApiError`. Regra: tipos de resposta só no contrato — web e mobile não os redefinem. A API importa dele **apenas com `import type`** (regra de ESLint), pois a parte de runtime depende de `axios`; por isso as listas de cores e ícones de disciplina ficam na API (`modules/subjects/subject-keys.ts`), tipadas com os tipos do contrato e checadas em tempo de compilação. O pacote tem testes (`npm test -w packages/api-contract`) e roda em um job próprio do CI.

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| API | NestJS 12 (Node 22, TypeScript 6) | Monorepo inteiro em TypeScript e mesmo padrão do backend do projeto Estagius; organização por módulos de feature |
| ORM | Prisma 7 com `@prisma/adapter-pg` | Schema declarativo, migrations versionadas e client tipado; o Prisma 8 ainda está em RC |
| Autenticação | Token opaco (personal access token) | Guarda só o hash SHA-256 no banco; o mesmo token Bearer atende web e mobile e é revogável no logout |
| Banco | PostgreSQL 17 (Docker, porta host 5433) | Transações, `SELECT … FOR UPDATE`/`FOR SHARE` e índices únicos parciais para moedas, respostas e resgates |
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
- Autorização por `RolesGuard`, **negada por padrão**: toda rota não pública declara `@Roles(Role.Admin, Role.Teacher)` ou `@AnyAuthenticated()` (qualquer perfil logado, ex.: `GET /auth/me`); sem isso a resposta é 403. O teste `test/route-authorization.e2e-spec.ts` percorre todas as rotas do `AppModule` e falha se alguma não declarar. Regras de posse (professor só mexe no que é seu) ficam nos services, partindo dos filtros de `src/shared/scopes/` (`classroomScope`, `studentScope`, `planScope` e, para o aluno, `studentPlanScope`), que valem também nas escritas. Recurso fora do escopo (turma, aluno, plano ou capítulo de outro professor; plano não publicado ou não atribuído ao aluno) responde **404** (nunca 403), para não confirmar que ele existe; só a RN02 (editar a questão de outro autor) responde 403.
- Erros em JSON `{ message, errors? }`, padronizados por um filtro global: 422 validação (`errors: { campo: [mensagens] }`), 401/403 autenticação/autorização, 404, 409 conflito de regra de negócio (`BusinessRuleException`), 500 sem detalhes internos. Mensagens em português do Brasil.
- Busca parcial (`?search=`) usa `containsInsensitive()` (`src/shared/prisma/contains-insensitive.ts`): o Prisma repassa `%`, `_` e `\` ao `ILIKE` sem escapar, então o helper escapa os curingas e a pessoa busca texto literal. Nunca monte `{ contains, mode: 'insensitive' }` à mão.
- Arquivos enviados (imagem da questão, `POST /questions/:id/image`): o multer recebe o arquivo em memória (limite duro de 5 MB; regra de negócio de 2 MB), a API confere a assinatura dos bytes (JPG, PNG ou WEBP) e grava em `UPLOADS_DIR/questions/<id>-<uuid>.<ext>` (padrão `uploads/`, ignorado pelo git; nos e2e, uma pasta temporária criada com `mkdtemp` em `test/helpers/uploads.ts` e apagada ao fim da suíte). A pasta é servida como estático em **`/uploads`**, fora do prefixo `/api/v1`, sem listagem de pasta, sem arquivos ocultos e com `X-Content-Type-Options: nosniff`. A API devolve `image_url` como **caminho relativo à raiz** (`/uploads/questions/<arquivo>`), sem host: cada cliente monta a URL com `resolveAssetUrl(apiBaseUrl, image_url)` do `@nivela/api-contract`, que usa a origem do endereço da API já configurado (`VITE_API_URL`, `EXPO_PUBLIC_API_URL`), então funciona no emulador, no celular e no web sem configuração extra. O banco guarda só o caminho relativo, e o arquivo antigo é apagado ao trocar ou remover a imagem (nunca fora de `UPLOADS_DIR`). Em produção, a pasta precisa estar em volume persistente.
- CORS: sem configuração, a API libera as origens de desenvolvimento (Vite em 5173 e Expo web em 8081/19006). Para outras origens (por exemplo o Vite em outra porta, quando a 5173 está ocupada), defina `CORS_ORIGINS` com as origens separadas por vírgula.
- Campos JSON (corpo, resposta e query string) sempre em `snake_case` (`join_code`, `created_at`).
- Datas e horas no banco como `TIMESTAMPTZ(3)` (`@db.Timestamptz(3)` em todo `DateTime` do schema; datas sem hora, como `last_study_date`, ficam `DATE`). Migrations que convertem colunas existentes usam `ALTER COLUMN … TYPE TIMESTAMPTZ(3) USING … AT TIME ZONE 'UTC'`.
- Paginação `{ data, meta: { page, per_page, total, last_page } }`, com `?page=` (≥ 1, padrão 1) e `?per_page=` (1–100, padrão 15): a rota recebe `@Query() query: PaginationQueryDto` e o service usa `toPrismaPage(query)` no `findMany` e `paginate(data, total, query)` na resposta (`src/shared/pagination/`).
- Documentação interativa em `http://localhost:8000/docs` (JSON em `/docs-json`). O plugin da CLI do `@nestjs/swagger` (`nest-cli.json`, com `classValidatorShim` e `introspectComments`) gera o schema dos DTOs a partir dos tipos, dos decorators do class-validator e dos comentários `/** … */` das propriedades, sem `@ApiProperty` manual. Vale para `nest start`/`nest build`; nos testes (ts-jest) o plugin não roda.

## Estudo: respostas, moedas e planos

Regras do Plano 3, todas implementadas na API (o app só apresenta).

### Resposta, tentativas e moedas

- `POST /answers` recebe `{ question_id, selected_letter, plan_chapter_id? }`. A API resolve a alternativa por `(question_id, letter)`; o `selected_option_id` gravado em `question_attempts` continua válido porque as alternativas são atualizadas no lugar. Uma FK composta `(selected_option_id, question_id)` impede gravar alternativa de outra questão.
- O aluno nunca recebe `correct_letter` nem `explanation` antes de a questão terminar (RN05): a questão do aluno é o tipo `ApiStudentQuestion` (presenter próprio) e a correção só vem em `ApiAnswerResult`, quando `finished`.
- **Tentativas por contexto (RN03):** índices únicos parciais em `question_attempts` — `question_attempts_practice_key` `(student_id, question_id, attempt_number) WHERE plan_chapter_id IS NULL` e `question_attempts_chapter_key` (inclui `plan_chapter_id`) `WHERE plan_chapter_id IS NOT NULL`.
- **`CoinLedger` (`src/shared/coins/coin-ledger.ts`):** único caminho que mexe em moedas (RN10): insere a linha em `coin_transactions` e atualiza `student_profiles.coins_balance` na mesma transação, sempre depois de travar o perfil (`FOR UPDATE`). Os tipos de `reason` aceitos são restritos em tempo de compilação, e a soma do extrato é sempre igual ao saldo.
- **"Uma vez" garantido pelo banco:** índices únicos parciais em `coin_transactions(student_id, source_id)` por motivo — `coin_once_per_question` (`correct_answer`), `coin_once_per_plan` (`plan_completed`) e `coin_once_per_streak_day` (`streak_bonus`). O `CoinLedger` insere com `ON CONFLICT DO NOTHING` e só atualiza o saldo se a linha entrou, então prêmio repetido (reentrada, concorrência, assentamento repetido) é inofensivo e devolve 0. O estorno (`refund`) ainda não tem essa garantia (Plano 4).
- **Dia de estudo (RN09):** `studyDay(date)` (`src/shared/study/study-day.ts`) devolve `YYYY-MM-DD` em `America/Fortaleza` com `Intl.DateTimeFormat`, independente do fuso do servidor; o `StreakService` compara dias consecutivos (`dayNumber`) e paga +20 moedas a cada 7 dias, uma vez por dia (índice acima). `last_study_date` é `DATE`. O "agora" vem do `CLOCK` injetável (`ClockModule` compartilhado; nos e2e, `createTestApp` o troca por um `TestClock` fixo, ajustável por teste).
- **Sequência efetiva (Ruling 10):** a sequência gravada só muda quando o aluno responde, então toda leitura (`GET /me/stats`, ficha `GET /students/:id`) usa `StreakService.effective(perfil, agora)`: `current` vale 0 quando o último dia de estudo foi há mais de 1 dia (em Fortaleza); `best` nunca muda. O `streak` de `ApiAnswerResult` já sai da gravação do dia.

### Ordem de travas (evita deadlock)

Toda transação que mexe no estudo pega as travas sempre nesta ordem: **perfil do aluno (`FOR UPDATE`) → plano (`FOR SHARE`) → questão (`FOR SHARE`)**. Respostas simultâneas do mesmo aluno se serializam no perfil; o `FOR SHARE` no plano fecha a corrida com a remoção de questões do plano, e o da questão fecha a corrida com a troca da alternativa correta. Se um índice único ainda disparar (P2002 aborta a transação do Postgres), o erro é traduzido para 409 fora da transação.

- **Regra do perfil:** o perfil do aluno é sempre o **primeiro** lock da transação do aluno; prêmio, resgate, plano e questão vêm depois. O `CoinLedger` (`credit`/`debit`) trava o perfil de novo antes de tocar no extrato (reentrante na mesma transação).
- **Transações da equipe** nunca travam perfil de aluno e pegam no máximo os itens finais da mesma ordem: editar plano, capítulos ou atribuição trava **só o plano** (`lockPlan` com `UPDATE`, ou `FOR SHARE` ao atribuir); montar as questões de um capítulo trava o plano e depois as questões pedidas (`FOR SHARE`); `PUT /questions/:id` trava **só a questão** (`FOR UPDATE`). Como a ordem é a mesma (plano antes de questão), não há ciclo com as transações do aluno.
- **Leituras que assentam conclusão** (lista e detalhe do plano do aluno, progresso da equipe, ficha do aluno) abrem uma transação por (aluno, plano) com perfil `FOR UPDATE` → plano `FOR SHARE`, a mesma ordem da resposta.
- **Plano 4 (resgate e estorno):** perfil `FOR UPDATE` → prêmio (`rewards`) `FOR UPDATE` → resgate (`redemptions`) → débito/crédito no `CoinLedger`. No estorno pela equipe, o `student_id` do resgate é lido **antes, sem trava**, para travar o perfil primeiro; depois, já com o perfil travado, o resgate é relido com `FOR UPDATE` e o estado é conferido de novo.

### Política de edição de questão

Questão com tentativas registradas continua editável (enunciado, alternativas, explicação), mas **não troca a alternativa correta**: `PUT /questions/:id` responde 409. A checagem acontece dentro da transação, depois de travar a linha da questão, e a ordem de travas acima garante que ou a tentativa já existe (o `PUT` recebe 409) ou a resposta lê a correta já trocada. Questão com tentativas também não é excluída, só desativada (RN02). Questão que está em algum capítulo de plano **não troca de disciplina** (422 em `subject_id`: "A questão está em um plano; não é possível trocar a disciplina."), porque o plano é de uma disciplina só; a checagem também acontece depois do lock da questão, e `PUT /plans/:id/chapters/:chapterId/questions` trava as questões pedidas com `FOR SHARE` antes de conferir a disciplina. A FK composta `questions(category_id, subject_id) → categories(id, subject_id)` garante no banco que a categoria pertence à disciplina.

### Planos e estado dos capítulos

- Planos nascem em rascunho; só publicados podem ser atribuídos (RN08). Atribuição a turma **ou** a aluno (CHECK + únicos parciais `plan_assignments_classroom_key`/`_student_key`), com prazo opcional (dia civil). Com qualquer tentativa registrada num capítulo do plano, remover capítulos ou questões responde 409.
- As posições de `plan_chapters` e `chapter_question` têm únicos **`DEFERRABLE INITIALLY DEFERRED`**, para reordenar numa transação sem violar a unicidade no meio. Eles são criados no SQL da migration e também declarados no `schema.prisma` com `@@unique(..., map: "...")` (o Prisma não distingue DEFERRABLE; assim o `migrate diff` fica vazio). Ao editar migrations futuras, confira que não foram recriados sem `DEFERRABLE`.
- **Conclusão de capítulo é derivada** (`chapter-states.ts`): um capítulo está `completed` se tem linha em `chapter_completions`, **ou** todas as suas questões ativas foram terminadas pelo aluno naquele capítulo, **ou** não tem questão ativa e o anterior está concluído. Assim, desativar uma questão depois de o aluno terminar as outras não trava ninguém. Estados: `locked` (o anterior não concluiu), `available` e `completed`; o primeiro capítulo nunca é trancado (RN06). Plano sem capítulos nunca conclui.
- **Conclusão do plano exige resposta (Ruling 9):** o plano só conclui (e só paga o bônus) se já foi gravado ou se tem capítulos, todos concluídos, **e** o aluno terminou ao menos uma tentativa (acerto ou 2ª tentativa) num capítulo dele. Desativar todas as questões de um plano não paga bônus a quem nunca respondeu.
- **Fonte única (Ruling 11):** `PlanCompletionService` (`load` + `resolvePlanState` de `chapter-states.ts`) é o único resolvedor de conclusão, usado pelo aluno (`GET /me/plans`, `GET /me/plans/:id`, capítulo, `POST /answers`) e pela equipe (`GET /plans/:id/progress`, `GET /students/:id/plans`). Aluno e equipe veem os mesmos `completed_chapters`/`total_chapters`, e `completed_at` é sempre a data gravada.
- **Assentamento:** a conclusão derivada é gravada (`chapter_completions` de todo capítulo concluído derivado, **inclusive os vazios**, para que adicionar uma questão depois não tranque o seguinte; `plan_completions` e o bônus, único por `coin_once_per_plan`) de forma idempotente, numa transação por (aluno, plano) com perfil `FOR UPDATE` → plano `FOR SHARE`. Acontece na resposta que conclui, ao abrir `GET /me/plans/:id` (capítulos ou plano pendentes), quando a próxima questão do capítulo acaba e, para planos concluídos ainda não gravados, na lista `GET /me/plans` e nas leituras da equipe. Sem nada pendente, a leitura não escreve.
- **Responder em capítulo já concluído** é aceito (questões adicionadas depois ficam alcançáveis); não há novo bônus de capítulo.
- **`ApiAnswerResult.chapter.completed` e `plan.completed` são eventos:** verdadeiros só na resposta que concluiu o capítulo/plano; `false` se já estavam concluídos. O app só celebra quando `finished && completed`.
- Professor só vê progresso de alunos do seu escopo (`studentScope`) e planos próprios (`planScope`); aluno só lê planos por `studentPlanScope` (RN15).

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
