# Nivela — Pendências levadas para os próximos planos

Saída das revisões dos Planos 1 (fundação e autenticação), 2 (cadastros) e 3 (estudo). Cada plano seguinte começa lendo esta lista.

## Plano 2 — Cadastros (concluído)

Resolvido no Plano 2:

1. ~~Precedência no `RolesGuard`~~ — metadata do handler vence a da classe (resolver único em `authorization-metadata.ts`, com meta-teste de todas as rotas).
2. ~~Pacote `packages/api-contract`~~ — tipos de resposta e `parseApiError` compartilhados; job próprio no CI.
3. ~~`PasswordField` (web)~~ — movido para `src/components` e passa `slotProps.input`.
4. ~~Mensagens em inglês dos pipes do Nest e do multer~~ — o filtro de erros traduz as do `ParseFilePipe` e do multer (envio de imagem, usadas em produção) e também as do `ParseUUIDPipe` (`Identificador inválido.`) e do `ParseArrayPipe` (`Lista inválida.`). Estes dois ainda não são usados por nenhuma rota real (ids passam pelo `ParseIdPipe`); a tradução é preventiva e está coberta pelo `test/errors.e2e-spec.ts` com um controller de teste.
5. ~~`JoinCodeService.generate` check-then-insert~~ — trata P2002 e tenta de novo (criar e regenerar).
6. ~~`revokeOthers` ao desativar professor~~ — reutilizado.
7. ~~`deleteMany` de token expirado sem try/catch~~ — protegido.
8. ~~Code-splitting por rota no web~~ — rotas com `lazy` + `ErrorBoundary`.
9. ~~Onda final de correções (revisão final do Plano 2)~~ — alternativas da questão atualizadas no lugar por `(question_id, letter)` (nunca recriadas); `image_url` relativo à raiz + `resolveAssetUrl` no contrato (sem `PUBLIC_URL`); `ApiList`/`ApiImageUpload`/`ApiJoinCode` no contrato; parâmetro de query vazio = ausente em todas as listagens (`@EmptyAsUndefined()`); frases visíveis terminam com ponto (inclusive títulos de estado vazio); `ResourceState` na web; conta de aluno criada só por `StudentsService.createAccount`; convenção de filtros da web registrada em `docs/estruturaDePastas.md`.

Ainda abertos (o Plano 2 não tocou):

- **Preset compartilhado de ESLint/Prettier** para web e mobile (configs ~95% iguais).

## Plano 3 — antes de começar

Fazer no início do Plano 3, antes das telas de estudo:

- ~~Autocomplete com busca no servidor no kit da web, substituindo os dois selects que carregavam `per_page: 100` (professores ativos no `ClassroomFormDialog` e turmas no filtro da `StudentList`)~~ — resolvido no Plano 3 (`AsyncAutocomplete` em `src/components`; os dois selects usam busca no servidor).
- ~~Mobile: fake de HTTP que casa `params` e hook `useRemote` para as telas do aluno~~ — resolvido no Plano 3 (`expectParams` e `useRemote`).
- ~~`ApiStudentQuestion` separado, com presenter sem `correct_letter` nem `explanation` (RN05) e e2e afirmando isso~~ — resolvido no Plano 3.
- ~~Respostas por `selected_letter` (A–E), resolvidas por `(question_id, letter)`~~ — resolvido no Plano 3.
- ~~Política de editar questão com tentativas: 409 ao trocar `correct_letter`~~ — resolvido no Plano 3.
- ~~FK composta `questions(category_id, subject_id) → categories(id, subject_id)`~~ — resolvido no Plano 3.
- ~~`CHECK (coins_balance >= 0)` em `student_profiles`~~ — resolvido no Plano 3 (migration `20261110210000_answers`, constraint `student_profiles_coins_balance_check`).

- ~~Títulos de EmptyState sem ponto final~~ — resolvido no Plano 3 (Início e Estudar substituídos; a Loja já usa "Em breve.").

## Plano 3 — Estudo

- ~~Tela "Sem conexão" do app: texto por tipo de erro e botão "Sair"~~ — resolvido no Plano 3 (`OfflineScreen`: sem resposta, 5xx e outros erros têm texto próprio, com "Sair"). Opcional: textos distintos para 403/404/429, hoje no texto genérico.
- ~~"Hoje" para a sequência (RN09) em `America/Fortaleza`~~ — resolvido no Plano 3 (`studyDay`).
- (continua aberto) `KeyboardAvoidingView` com `padding` no Android edge-to-edge: conferir num aparelho.
- (continua aberto) `PenCard`: `margin` via `style` desalinha a sombra.

## Plano 3 — Onda final de correções (revisão final)

Resolvido na branch `feature/plan3-hardening`:

- ~~Bônus de plano sem nenhuma resposta~~ — o plano só conclui (e paga) com ao menos uma tentativa terminada num capítulo dele (Ruling 9).
- ~~Sequência vencida em `/me/stats` e na ficha~~ — `StreakService.effective` em toda leitura (Ruling 10).
- ~~Duas fontes de verdade da conclusão~~ — `PlanCompletionService` único para aluno e equipe; capítulos vazios derivados são gravados; lista e leituras da equipe assentam planos concluídos ainda não gravados; leitura sem pendência não escreve (Ruling 11).
- ~~Questão de plano trocando de disciplina~~ — 422 em `subject_id`.
- ~~Regra de travas do extrato e das transações da equipe~~ — documentada (`docs/architecture.md`, "Ordem de travas") e no `CoinLedger`.
- ~~e2e dependentes da hora real~~ — `createTestApp` usa um `TestClock` fixo.
- ~~`DELETE` de atribuição fora do escopo do professor~~ — mesmo `reachableTargets` da lista (404).
- ~~Comentário enganoso na criação de atribuição~~ — agora trava o plano com `FOR SHARE`.
- ~~Drift de migrations sem checagem no CI~~ — passo `prisma migrate diff --from-migrations --to-schema --exit-code` com banco-sombra.
- ~~`lockStudentProfile` sem perfil virava 500~~ — 404 "Aluno não encontrado.".
- ~~Flake do mobile sob carga~~ — `asyncUtilTimeout: 3000` e `--maxWorkers=50%` no CI.


## Sobras da revisão final do Plano 3

- ~~Plano com todas as questões desativadas aparece com capítulos "concluídos" (0/0) e 100%~~ — resolvido: app e painel avisam que o plano está sem questões disponíveis (ainda aberto: o cartão de "Meus planos" mostra 100% para plano vazio; veja "Sobras do Plano 4").
- ~~Leituras da equipe que assentam conclusões fazem um `settle` por aluno e uma falha devolvia 500 para a página inteira~~ — resolvido: a falha é isolada por aluno e logada.
- ~~`StreakService.register`: ramo "perfil inexistente" inalcançável~~ — removido.
- Testes e2e usam relógio fixo (`TestClock`, 2026-11-10): comparações com `created_at`/`updated_at` do banco devem usar o relógio do app.

## Plano 4 — Gamificação e relatórios

Todos os itens abaixo foram resolvidos no Plano 4 e estão documentados em `docs/architecture.md` ("Ordem de travas" e "Loja e indicadores"). As sobras estão em "Sobras do Plano 4".

- ~~**Regra de travas (vinculante):** o perfil do aluno é sempre o primeiro lock da transação; prêmio e resgate vêm depois. Resgate: perfil `FOR UPDATE` → prêmio `FOR UPDATE` (estoque) → resgate → `CoinLedger.debit`. Estorno pela equipe: ler o `student_id` do resgate **sem trava**, travar o perfil, reler o resgate com `FOR UPDATE`, conferir o estado e só então `CoinLedger.credit`. Transações da equipe que não mexem em moedas travam só o prêmio (ou só o resgate). Ver `docs/architecture.md`, "Ordem de travas".~~ — resolvido (a recusa trava perfil → resgate → prêmio, sem ciclo).
- ~~**Estorno "uma vez" no banco:** índice único parcial `coin_once_per_refund ON coin_transactions (student_id, source_id) WHERE reason = 'refund'`, com `source_id` = id do resgate; incluir `'refund'` em `ONCE_PER_SOURCE` do `CoinLedger` (o predicado do `ON CONFLICT` tem de ser idêntico ao do índice) e e2e de dois estornos simultâneos do mesmo resgate (um credita, o outro devolve `applied: false`; saldo = extrato).~~ — resolvido.
- ~~**Dashboards por dia em `America/Fortaleza`:** agrupar por `(created_at AT TIME ZONE 'America/Fortaleza')::date` (as colunas são `timestamptz`), com um helper SQL único que espelha `studyDay` (testado contra ele na virada da meia-noite), e sempre dentro do escopo de quem pede (`studentScope`/`planScope`, RN15).~~ — resolvido (`studyDaySql`).
- ~~**Taxa de acerto:** definida por questão terminada (acerto na 1ª ou 2ª tentativa sobre questões terminadas, cada questão contada uma vez por contexto), nunca por tentativa; sempre filtrada pelo escopo.~~ — resolvido.
- ~~**Presenter do extrato de moedas:** cada `reason` com seu texto; o `source_id` do `streak_bonus` é um número de dia (`dayNumber`), não um id — o presenter converte para a data (`YYYY-MM-DD`) em vez de buscar uma entidade.~~ — resolvido.

## Sobras do Plano 4

Decisões do Plano 4 já refletidas na documentação: ordem de travas por fluxo da loja, estorno uma vez no banco, `studyDaySql`, taxa de acerto por questão terminada, atividade por dia de término, "precisam de ajuda" só com alunos ativos e acerto arredondado, janelas do Início (30 dias) e desempenho de turma/aluno em todo o histórico.

- **API (loja):** `RewardImageService` e `QuestionImageService` são wrappers quase iguais e `ImageStorageService.save` repete a checagem de assinatura de `validate`; `REDEMPTION_STATUSES` duplica o enum; faltam e2e do `PUT` com descrição nula e da busca acima do tamanho máximo (422); a ordem de `RewardsModule` no `app.module` não é alfabética; o `docs/architecture.md` ainda usa rótulos "Ruling N" antigos (Rulings 9, 10, 11) em vez de nomes descritivos.
- **Testes (loja):** o helper `student(balance)` está copiado em dois e2e (`redemptions` e `redemptions-concurrency`) e o tipo `LockedRedemption` do serviço de resgates é usado em interseção com `price_paid`; extrair para `test/helpers` e unificar o tipo. Resolvido na onda final: a recusa agora falha se o `applied` do `credit()` for falso, o `PUT /rewards/:id` aceita `stock` ausente (não muda) e o e2e do estoque tem nome fiel ao que prova.
- **API (indicadores):** a CTE `contexts` varre todo o histórico e o resumo a executa duas vezes; o padrão `days = 14` está no DTO e no controller; a conversão `dayNumber` → data está duplicada (`formatDayNumber` e `shiftDay`; criar `fromDayNumber` em `study-day.ts`); o resumo (acerto e desempenho) inclui o histórico de alunos inativos, só "precisam de ajuda" filtra ativos; falta teste de que o desempenho da turma exclui outra turma do mesmo professor e um `dashboard.service.spec.ts`.
- **Web:** trocar ou remover a imagem do prêmio dispara também o aviso "Prêmio salvo."; o diálogo de edição continua aberto após salvar; a aba Prêmios limpa o `?tab` da URL; `RewardsCatalog` reimplementa paginação, vazio e erro; fallback `current?.id ?? 0` no upload; "Ver a lista." é uma âncora nativa; o `ActivityChart` vazio usa `|| 14` em vez de `ACTIVITY_DAYS`; faltam testes de envio/remoção de imagem, 409/422 na recusa, página > 1 vazia e dos 14 dias zerados.
- **Mobile (loja e extrato):** ao recarregar, o saldo e o estoque antigos piscam antes dos dados novos; o aviso de resgate não some nem tem botão de dispensar e o `GET /me/stats` é pedido duas vezes ao abrir; o botão de voltar de "Meus resgates" usa `borderRadius` 999 em vez de `radius.pill`; a imagem do prêmio repete o nome para leitores de tela; o erro unificado esconde as moedas já carregadas quando só as estatísticas falham; datas usam o fuso do aparelho (e as fixtures de data `T15:00Z` dependem do fuso do CI); o `expectParams` do teste "Carregar mais" de Meus resgates é tautológico (compara o que o próprio teste montou); o teste do aviso da loja é só estrutural (não cobre rolagem); faltam testes (404, erro não-409 mantém a folha, recarga ao focar, confirmação dupla, falha/novo carregamento do `CoinsCard` e do extrato) e abortar requisições ao desmontar.
- **Mobile (planos):** o cartão de "Meus planos" (`ApiMyPlanSummary`) ainda mostra 100% para plano sem questões disponíveis; precisa de um campo novo no contrato (por exemplo, `has_questions`). Faltam teste com vários capítulos e o aviso de plano vazio esconde o progresso já gravado.

## Plano 5 — Entrega

- **LICENSE**: perguntar ao autor qual licença open source (sugestão: MIT); hoje `apps/api/package.json` diz `UNLICENSED`.
- **APK**: `EXPO_PUBLIC_API_URL` é fixado no build; liberar HTTP em texto puro para IP da rede local (`expo-build-properties` → `usesCleartextTraffic`) ou usar HTTPS; publicar o APK num GitHub Release (o e-book exige "arquivos e executável").
- Rate limiting (`@nestjs/throttler`) em login/cadastro antes de qualquer demo compartilhada.
- `docs/defesa/roteiro-video.md`: vídeo de 8–12 min com os pontos obrigatórios da orientação (título, justificativa, etapas dos objetivos, ferramentas e métodos, resultados, trabalhos futuros) e quais telas mostrar.
- Texto pronto para a monografia justificando a troca Laravel → NestJS (monorepo 100% TypeScript, tipos compartilhados, padrão do Estagius).
- Seed de demonstração (turmas, questões de Matemática e Português, planos, prêmios) para gravar o vídeo.

## Sobras do Plano 2 (revisões das Tasks 1 a 13)

Prioridade para quem passar perto:

- **API:** `MaxLength(72)` conta caracteres, não bytes; `teacher_id` é validado mesmo quando ignorado para professor; falta e2e de `PUT` de professor com o próprio e-mail e testes de 403 em mais rotas (o guard é de classe); órfão de arquivo em trocas concorrentes de imagem (opcional); índice `categories_subject_id_idx` redundante; comentário do schema diz "espaços" (o trim é no DTO); `lower()` depende de `LC_CTYPE` UTF-8; `translate()` de subjects mapeia P2003 também em create/update; `design-tokens` está em `dependencies` do contrato (seria peer/dev); teal/coral claros não derivam de `brand`.
- **API (tipos):** o typecheck de `parseApiError` (axios) funciona por hoisting sem `axios` declarado na API; ordem de imports do contrato; alias redundante `required` no `RolesGuard`.
- **Web (componentes):** `Notify` substitui o aviso anterior (documentar); `DataTable` sem `caption`/`role` na linha clicável e erro com `role=status`; `lazy()` guarda o import rejeitado (voltar à mesma rota falha até recarregar; o botão Recarregar resolve); `HomePage`/`ComingSoon` em chunks minúsculos; diálogos sem animação de saída; grade não conferida em mobile/tablet; `SubjectBadge` fora do teste de contraste.
- **Web (telas):** categoria antiga fica selecionável por um instante ao trocar a disciplina no formulário de questão (a API rejeita com 422 tratado); botão Salvar não desabilita durante o toggle de status; `canEdit` da lista de questões é heurística do cliente (o 403 do servidor é a guarda real); lista de ícones em `optimizeDeps` mantida à mão; placeholders altos na ficha do aluno; reload após erro no toggle de professor.
- **Testes:** teste de cancelar confirmação frágil a requisição lenta (professores); 422/404 sem teste em edição e reset de senha de professor; ordem de import no `routes.test`; lacunas na turma (erro ao remover aluno, erro ao carregar professores, fallback de cópia sem asserção de seleção, clipboard redefinido no arquivo); RED do pacote de contrato não capturado; lista `implemented` de rotas do meta-teste precisa de atualização a cada task.
- **Mobile:** faltam testes de `normalizeJoinCode` direto (`"niv4k7q"`), erro não-422 no join e seção oculta para staff; o schema de cadastro importa o barrel inteiro da feature de turmas.
- **Histórico:** alguns commits do Plano 2 não compilam isoladamente (o último de cada feature compila).

## Sobras do Plano 3 (revisões das Tasks 1 a 10)

Decisões do Plano 3 já refletidas na documentação: conclusão de capítulo derivada com assentamento ao abrir o plano, resposta em capítulo concluído aceita, `chapter.completed`/`plan.completed` como evento, ordem de travas perfil → plano → questão, únicos de posição `DEFERRABLE` declarados com `map`.

- **API (planos):** ~~a lista `/me/plans` mostra `completed` derivado sem assentar o bônus~~, ~~plano com todas as questões desativadas paga o bônus sem nenhuma resposta~~, ~~o progresso da equipe conta só conclusões gravadas~~ e ~~transação de escrita a cada abertura do plano~~ — resolvidos na onda final (acima); ainda aberto: o assentamento não re-checa a visibilidade dentro da transação; prazo sem teste de borda da meia-noite; tradução de FK/posição no `ChaptersService` sem teste; cast em `presentAssignment`; corrida remoção × resposta sem e2e (fechada por lock, verificada por leitura).
- **API (respostas e moedas):** o e2e concorrente da resposta não prova o bloqueio (o da virada da meia-noite foi tornado determinístico nas Tasks 5 e 7: barreira + espera em `pg_stat_activity`, filtro por `datname` e release em `finally`); `MAX_ID` repetido em 7 lugares e `OPTION_LETTERS` em 2 (mover para `src/shared/validation`); `remaining`/`attempts_left` lidos fora da transação (cosmético); ~~`refund` sem garantia "uma vez"~~ (resolvido no Plano 4).
- **API (cadastros):** ramo `questions_category_id_fkey` morto no `translate` (e teste); checagem de questões em `SubjectsService.remove` inalcançável sem teste; e2e "mover categoria" usa `rejects.toBeDefined`.
- **Web:** `QuestionPicker` filtra "já no capítulo" depois dos 20 da página, sem "carregar mais"; `aria-controls` de abas não renderizadas; botões de questão sem o nome do capítulo; `useEffect` de erro morto no editor; data mínima do prazo pelo dia local do navegador; `failedId` nunca limpo; faltam testes (409 ao remover questão, paginação da lista); `AsyncAutocomplete`: valor selecionado fora das `options` (possível aviso do MUI), texto da busca mantido após selecionar, teste sem fake timers para o debounce de 300 ms, `StudentList` engole erro não-404 ao resolver a turma, `setSelected`+`setFilter` separados, indentação no `ClassroomList.test`, `selected` local no `ClassroomFormDialog`.
- **Mobile:** `questionsLabel` ainda duplicado no cabeçalho do card da disciplina (cosmético); ramos animados sem teste (o dublê sempre reduz movimento); imagem da questão sem texto alternativo (o contrato não tem); falha no reload ao voltar zera `StatsBar`/`StudyHome` em vez de manter os valores antigos; ~~2 testes falharam uma vez sob carga junto com o e2e~~ (resolvido na onda final: `asyncUtilTimeout: 3000`); `PageTurn` não visto em aparelho; `signOut` limpa o token só depois do `POST /auth/logout`; `joined` local sobrescreve a cópia do servidor; sem teste de retry atualizando `offlineStatus`; o `catch` do `expectParams` descarta o diff do Jest.
- **Histórico:** o commit `59de96c` tem erro de lint (corrigido no seguinte); typo na mensagem do commit `1ee3443`.

## Pequenos (quando passar perto)

- Web: `getMe`/`logout` sem uso na feature `auth`; sem teste de `signOut` com `/me` pendente; inputs do login sem `aria-describedby` para o alerta; alerta de sucesso do Perfil persiste; `autoComplete="username"` → `email`; teste de rota aninhada ativa no menu; regex de hex pega strings como `'#add'`; `favicon.svg` com hex manual.
- Mobile: `getMe`/`logout` sem uso; `setLeaving` após desmontar.
- API: transformer ESM do Jest com regex e chave de cache fixa (subir `esm-transformer-v1` ao mudar); `moduleNameMapper` do e2e duplicado.
- Tokens: `contrastRatio` não aceita hex de 3 dígitos; testes de `spacing`/`radius`/`penShadow`.
