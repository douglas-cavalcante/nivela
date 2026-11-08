# Nivela — Pendências levadas para os próximos planos

Saída das revisões dos Planos 1 (fundação e autenticação) e 2 (cadastros). Cada plano seguinte começa lendo esta lista.

## Plano 2 — Cadastros (concluído)

Resolvido no Plano 2:

1. ~~Precedência no `RolesGuard`~~ — metadata do handler vence a da classe (resolver único em `authorization-metadata.ts`, com meta-teste de todas as rotas).
2. ~~Pacote `packages/api-contract`~~ — tipos de resposta e `parseApiError` compartilhados; job próprio no CI.
3. ~~`PasswordField` (web)~~ — movido para `src/components` e passa `slotProps.input`.
4. ~~Mensagens em inglês do `ParseFilePipe`/multer~~ — traduzidas no filtro de erros (envio de imagem).
5. ~~`JoinCodeService.generate` check-then-insert~~ — trata P2002 e tenta de novo (criar e regenerar).
6. ~~`revokeOthers` ao desativar professor~~ — reutilizado.
7. ~~`deleteMany` de token expirado sem try/catch~~ — protegido.
8. ~~Code-splitting por rota no web~~ — rotas com `lazy` + `ErrorBoundary`.

Ainda abertos (o Plano 2 não tocou):

- **Preset compartilhado de ESLint/Prettier** para web e mobile (configs ~95% iguais).

## Plano 3 — Estudo

- Tela "Sem conexão" do app aparece para qualquer erro não-401 (403/404/429) e não tem botão de sair — ajustar texto por tipo de erro e oferecer "Sair".
- "Hoje" para a sequência (RN09) calculado explicitamente em `America/Fortaleza` no service (as colunas já são `TIMESTAMPTZ`).
- `KeyboardAvoidingView` com `padding` no Android edge-to-edge: conferir num aparelho.
- Fake de HTTP dos testes do mobile casa só método + URL; estender para `params` (filtros) ou adotar MSW.
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

- **API:** `BCRYPT_COST` duplicado em auth e teachers (constante compartilhada); `MaxLength(72)` conta caracteres, não bytes; `teacher_id` é validado mesmo quando ignorado para professor; falta e2e de `PUT` de professor com o próprio e-mail e testes de 403 em mais rotas (o guard é de classe); órfão de arquivo em trocas concorrentes de imagem (opcional); `subject_id` × categoria só garantido no service; índice `categories_subject_id_idx` redundante; comentário do schema diz "espaços" (o trim é no DTO); `lower()` depende de `LC_CTYPE` UTF-8; `translate()` de subjects mapeia P2003 também em create/update; `design-tokens` está em `dependencies` do contrato (seria peer/dev); teal/coral claros não derivam de `brand`.
- **API (tipos):** o typecheck de `parseApiError` (axios) funciona por hoisting sem `axios` declarado na API; ordem de imports do contrato; alias redundante `required` no `RolesGuard`.
- **Web (componentes):** `Notify` substitui o aviso anterior (documentar); `DataTable` sem `caption`/`role` na linha clicável e erro com `role=status`; `lazy()` guarda o import rejeitado (voltar à mesma rota falha até recarregar; o botão Recarregar resolve); `HomePage`/`ComingSoon` em chunks minúsculos; diálogos sem animação de saída; grade não conferida em mobile/tablet; `SubjectBadge` fora do teste de contraste.
- **Web (telas):** selects limitados a 100 itens sem aviso; categoria antiga fica selecionável por um instante ao trocar a disciplina no formulário de questão (a API rejeita com 422 tratado); botão Salvar não desabilita durante o toggle de status; `canEdit` da lista de questões é heurística do cliente (o 403 do servidor é a guarda real); lista de ícones em `optimizeDeps` mantida à mão; placeholders altos na ficha do aluno; reload após erro no toggle de professor.
- **Testes:** teste de cancelar confirmação frágil a requisição lenta (professores); 422/404 sem teste em edição e reset de senha de professor; ordem de import no `routes.test`; lacunas na turma (erro ao remover aluno, erro ao carregar professores, fallback de cópia sem asserção de seleção, clipboard redefinido no arquivo); RED do pacote de contrato não capturado; lista `implemented` de rotas do meta-teste precisa de atualização a cada task.
- **Mobile:** faltam testes de `normalizeJoinCode` direto (`"niv4k7q"`), erro não-422 no join e seção oculta para staff; o schema de cadastro importa o barrel inteiro da feature de turmas.
- **Convenção:** filtros vazios (`''`) devem ser omitidos dos params da API; select com default não vazio precisa de opção "Todos" = `''`.
- **Histórico:** alguns commits do Plano 2 não compilam isoladamente (o último de cada feature compila).

## Pequenos (quando passar perto)

- Web: `getMe`/`logout` sem uso na feature `auth`; sem teste de `signOut` com `/me` pendente; inputs do login sem `aria-describedby` para o alerta; alerta de sucesso do Perfil persiste; `autoComplete="username"` → `email`; teste de rota aninhada ativa no menu; regex de hex pega strings como `'#add'`; `favicon.svg` com hex manual.
- Mobile: `getMe`/`logout` sem uso; `setLeaving` após desmontar.
- API: transformer ESM do Jest com regex e chave de cache fixa (subir `esm-transformer-v1` ao mudar); `moduleNameMapper` do e2e duplicado; `MaxLength(72)` conta caracteres, não bytes.
- Tokens: `contrastRatio` não aceita hex de 3 dígitos; testes de `spacing`/`radius`/`penShadow`.
