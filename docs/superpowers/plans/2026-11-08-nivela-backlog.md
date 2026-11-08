# Nivela — Pendências levadas para os próximos planos

Saída das revisões dos Planos 1 (fundação e autenticação) e 2 (cadastros). Cada plano seguinte começa lendo esta lista.

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

- **Autocomplete com busca no servidor** no kit da web (componente em `src/components`), substituindo os dois selects que carregam `per_page: 100` (professores ativos no `ClassroomFormDialog` e turmas no filtro da `StudentList`) — hoje eles cortam em 100 itens sem aviso.
- **Mobile:** o fake de HTTP dos testes passa a casar também os `params` (filtros), e um hook `useRemote` (equivalente ao `useRemoteList` da web: cancelamento, resposta atrasada descartada, reload) para as telas do aluno.
- **`ApiStudentQuestion` separado** + presenter próprio **sem `correct_letter` nem `explanation`** (RN05: o aluno só vê a correção depois de responder), com e2e afirmando que esses campos não vêm na resposta.
- **Respostas por `selected_letter`** (A–E) no corpo da requisição; a API resolve a alternativa por `(question_id, letter)` — as alternativas já são atualizadas no lugar, então o `selected_option_id` gravado continua válido.
- **Política de editar questão com tentativas:** bloquear a troca de `correct_letter` com **409** quando a questão já tem respostas (texto, enunciado e explicação continuam editáveis).
- **FK composta** `questions(category_id, subject_id) → categories(id, subject_id)` (com `UNIQUE (id, subject_id)` em `categories`), para o banco garantir que a categoria pertence à disciplina (hoje só o service garante).
- (Plano 4) **`CHECK (coins_balance >= 0)`** em `student_profiles`.

## Plano 3 — Estudo

- Tela "Sem conexão" do app aparece para qualquer erro não-401 (403/404/429) e não tem botão de sair — ajustar texto por tipo de erro e oferecer "Sair".
- "Hoje" para a sequência (RN09) calculado explicitamente em `America/Fortaleza` no service (as colunas já são `TIMESTAMPTZ`).
- `KeyboardAvoidingView` com `padding` no Android edge-to-edge: conferir num aparelho.
- `PenCard`: `margin` via `style` desalinha a sombra.

## Plano 4 — Gamificação e relatórios

- Dashboards agrupados por dia em `America/Fortaleza`.

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

## Pequenos (quando passar perto)

- Web: `getMe`/`logout` sem uso na feature `auth`; sem teste de `signOut` com `/me` pendente; inputs do login sem `aria-describedby` para o alerta; alerta de sucesso do Perfil persiste; `autoComplete="username"` → `email`; teste de rota aninhada ativa no menu; regex de hex pega strings como `'#add'`; `favicon.svg` com hex manual.
- Mobile: `getMe`/`logout` sem uso; `setLeaving` após desmontar.
- API: transformer ESM do Jest com regex e chave de cache fixa (subir `esm-transformer-v1` ao mudar); `moduleNameMapper` do e2e duplicado.
- Tokens: `contrastRatio` não aceita hex de 3 dígitos; testes de `spacing`/`radius`/`penShadow`.
