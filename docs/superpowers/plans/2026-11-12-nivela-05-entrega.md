# Nivela — Plano 5: Entrega

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Nivela pronto para a defesa e para o artigo: API protegida contra força bruta, app com endereço do servidor configurável e APK instalável, banco de demonstração para gravar o vídeo, material do artigo (requisitos, UML, prints, textos) e a versão 1.0.0 com licença MIT.

**Architecture:** Mudanças pequenas e isoladas por área. Na API, `@nestjs/throttler` só nas rotas públicas de autenticação, com chave por IP + e-mail no login. No app, o endereço da API passa de constante de build para um valor salvo no aparelho (padrão = `EXPO_PUBLIC_API_URL`), lido pelo axios e por `resolveAssetUrl`. O APK sai de um build local (CNG: `expo prebuild` gera `android/`, que não é versionado) com HTTP liberado para rede local. O seed de demonstração é um script separado do seed do admin, idempotente e testado contra o banco de teste. O fechamento segue o gitflow da spec (`release/1.0.0` → `main` + tag assinada → `develop`).

**Tech Stack:** o mesmo dos Planos 1–4; `@nestjs/throttler` (API), `expo-build-properties` (mobile), Gradle com o JDK 17 do Android Studio (`C:\Program Files\Android\Android Studio\jbr`) e o Android SDK em `C:\Android\Sdk` (build-tools 35, platform 35), `@mermaid-js/mermaid-cli` (PNG dos diagramas) e Playwright (prints do painel), ambos só como ferramentas de documentação.

**Spec:** `docs/superpowers/specs/2026-11-08-nivela-design.md` (§8 requisitos não funcionais, §10 Git e entrega, §11 Material para o artigo). Pendências de entrada: `docs/superpowers/plans/2026-11-08-nivela-backlog.md` ("Plano 5 — Entrega" e "Sobras do Plano 4").

**Decisões do autor (2026-11-12):** licença **MIT**; endereço da API **configurável no app**; APK por **build local com Gradle**.

## Global Constraints

- Ambiente: Windows 11 + Git Bash, Node **22.14** (não atualizar), npm 10, Docker com `nivela_db` (porta 5433, bancos `nivela` e `nivela_test`). Portas livres; nunca encerrar processos que não iniciou.
- Ler antes de codar: `CLAUDE.md`, `docs/architecture.md`, `docs/estruturaDePastas.md`, `docs/workflow.md`.
- Mensagens e textos em pt-BR, frases completas com ponto. Cores só por tokens. TypeScript estrito sem `any` explícito. Imports `src/...`; features só pelo `index.ts`/módulo.
- Deny-by-default continua valendo; nenhuma rota nova sem papel declarado.
- **Banco `nivela` do usuário:** nenhum script deste plano apaga dados dele. O seed de demonstração só **acrescenta** e se recusa a rodar duas vezes; testes rodam no `nivela_test`.
- **Nada sai da máquina sem autorização do usuário na conversa:** `git push`, GitHub Release, upload do APK e mudança de visibilidade do repositório são feitos pelo controlador, depois de perguntar, na Task 8.
- Prisma: nunca `prisma migrate reset`; drift vazio.
- Testes: API unit + e2e; web Vitest + MSW; mobile jest-expo com o fake de `src/test/render.tsx`. Saída limpa; `npx expo export --platform android` passando.
- Commits: Conventional Commits em pt-BR com escopo, **sem `Co-Authored-By`**; assinatura SSH já configurada no repositório (commits e tags) — não mexer em `git config`. O implementador não faz merge nem push.
- Arquivos gerados que não entram no git: `apps/mobile/android/`, `apps/mobile/dist/`, `dist/*.apk`.

## Review Focus

1. **Turma inteira entrando ao mesmo tempo pelo Wi-Fi da escola (mesmo IP)** → ninguém é bloqueado por causa dos colegas; o limite do login é por IP **e** e-mail, e o do cadastro é folgado por IP. Testes na Task 1.
2. **Endereço do servidor digitado errado** (sem `http://`, com `/` no fim, sem `/api/v1`, IP inexistente) → o app normaliza o que dá, testa a conexão antes de salvar e mostra "Não foi possível conectar a este endereço." sem trocar o endereço atual. Testes na Task 2.
3. **Trocar o servidor com uma sessão aberta** → o token do servidor antigo nunca vai para o novo; trocar o endereço encerra a sessão. Imagens passam a vir do novo endereço. Testes na Task 2.
4. **APK de release falando HTTP com o IP da rede local** → funciona (cleartext liberado no build); o app não fica "Sem conexão com o servidor." no celular físico. Verificação na Task 3 (config testada + instalação no emulador).
5. **Seed de demonstração rodado duas vezes, ou num banco que já tem dados do professor** → a segunda execução não duplica nada e avisa; nunca altera o admin nem apaga dados; o banco fica consistente (saldo = soma do extrato, estoque ≥ 0, resgates recusados com estorno). Testes na Task 4.

---

### Task 1: Limite de tentativas na autenticação

**Branch:** `feature/rate-limit`

**Files:**
- Modify: `apps/api/package.json` (`@nestjs/throttler`), `apps/api/src/app.module.ts`, `apps/api/src/modules/auth/auth.controller.ts` (`POST /auth/login` e `POST /auth/register-student`), `apps/api/.env.example` (e a leitura/validação das variáveis no padrão já usado pela API)
- Create: `apps/api/src/shared/security/login-throttler.guard.ts` (+ spec)
- Test: `apps/api/test/rate-limit.e2e-spec.ts`

**Interfaces:**
- Produces: limites configuráveis por ambiente — `THROTTLE_LOGIN_LIMIT` (padrão **10**) e `THROTTLE_REGISTER_LIMIT` (padrão **30**), janela `THROTTLE_TTL_SECONDS` (padrão **60**). Só `POST /auth/login` e `POST /auth/register-student` são limitados; o resto da API não muda.
- Chave do login: `ip + ':' + email normalizado (trim + minúsculas)`; e-mail ausente cai só no IP. Chave do cadastro: IP. `app.set('trust proxy', …)` **não** é ligado (sem proxy na implantação do TCC; documentar).
- Resposta ao estourar: **429** `{ message: 'Muitas tentativas. Aguarde um minuto e tente de novo.' }` no formato de erro da API, com `Retry-After`.
- O `createTestApp` dos e2e usa limites altos por padrão (os outros e2e não podem quebrar); `rate-limit.e2e-spec.ts` sobe o app com limite baixo (ex.: 3) para provar o 429.

- [ ] **Step 1:** `git checkout develop && git pull --ff-only && git checkout -b feature/rate-limit`
- [ ] **Step 2: Testes que falham** — e2e: 4º login errado do mesmo e-mail e IP → 429 com a mensagem e `Retry-After`; outro e-mail do mesmo IP continua 401/200 (Review Focus 1); login certo depois da janela (relógio do throttler/`ttl` curto) volta a funcionar; cadastro estoura por IP no limite configurado; rota fora da autenticação (ex.: `GET /health`) nunca recebe 429; unit do guard: chave com e-mail normalizado e fallback para IP.
- [ ] **Step 3:** FAIL → implementar → PASS (unit, e2e completo em segundo plano, lint, typecheck, build).
- [ ] **Step 4: Commits** `feat(api): limita tentativas de login e cadastro` · `test(api): cobre o limite de tentativas por e-mail e por ip`

---

### Task 2: Endereço do servidor configurável no app

**Branch:** `feature/mobile-server-url`

**Files:**
- Create: `apps/mobile/src/lib/server-url/{serverUrl.ts, serverUrl.test.ts, ServerUrlProvider.tsx, useServerUrl.ts, index.ts}`, `apps/mobile/src/features/auth/components/ServerUrlSheet.tsx`
- Modify: `apps/mobile/src/lib/axios.ts` (base URL dinâmica), as telas de `(auth)` (`welcome.tsx`, `login.tsx`), os três usos de `resolveAssetUrl(process.env.EXPO_PUBLIC_API_URL …)` (`RewardCard`, `RedemptionRow`, `QuestionView`), `apps/mobile/src/test/render.tsx` e `src/test/setup.ts` se preciso, `apps/mobile/.env.example`, README

**Interfaces:**
- `normalizeServerUrl(input: string): string | null` — trim; sem esquema → prefixa `http://`; só `http:`/`https:`; remove `/` final; caminho vazio → acrescenta `/api/v1`; inválido → `null`. Exemplos que viram teste: `"192.168.0.10:8000"` → `"http://192.168.0.10:8000/api/v1"`; `"http://10.0.2.2:8000/"` → `"http://10.0.2.2:8000/api/v1"`; `"https://x.com/api/v1/"` → `"https://x.com/api/v1"`; `"ftp://x"` → `null`; `""` → `null`.
- Armazenamento: `expo-secure-store`, chave `nivela.serverUrl`. Leitura no início do app; sem valor salvo → `EXPO_PUBLIC_API_URL` (a validação atual com mensagem clara continua valendo para o padrão).
- `useServerUrl(): { url: string; isDefault: boolean; change(input: string): Promise<'ok' | 'invalid' | 'unreachable'>; reset(): Promise<void> }`. `change` normaliza, faz `GET <url>/health` (timeout curto, ex. 5 s); só salva quando responde 2xx; **ao salvar um endereço diferente, encerra a sessão** (limpa o token como o `signOut` faz, sem chamar o logout do servidor antigo) — Review Focus 3.
- `axios` lê a base do endereço atual a cada requisição (interceptor), nunca uma constante de módulo. `resolveAssetUrl` recebe o endereço atual do hook.
- UI: em Boas-vindas e Login, linha discreta "Servidor: 192.168.0.10:8000 · Alterar" (sem o `http://` e o `/api/v1`), que abre `ServerUrlSheet` com campo, "Testar e salvar", "Usar o padrão" e mensagens: inválido → "Digite um endereço como 192.168.0.10:8000."; inalcançável → "Não foi possível conectar a este endereço."; sucesso → "Servidor atualizado.". Texto de ajuda: "Use o IP do computador que roda a API, na mesma rede Wi-Fi.".

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/mobile-server-url`
- [ ] **Step 2: Testes que falham** — unit `normalizeServerUrl` com os exemplos acima; provider: sem valor salvo usa o padrão; valor salvo é usado pelo axios (fake confere a URL chamada); `change` com `/health` falhando → `'unreachable'` e endereço intacto; `change` com sucesso salva, troca a base do axios e limpa o token; imagens usam o endereço novo; tela de login mostra o servidor e a sheet mostra as três mensagens.
- [ ] **Step 3:** FAIL → implementar → PASS (lint, typecheck, jest, `expo export`).
- [ ] **Step 4: Commits** `feat(mobile): permite configurar o endereço do servidor no app` · `feat(mobile): encerra a sessão ao trocar de servidor`

---

### Task 3: APK de release

**Branch:** `feature/android-apk`

**Files:**
- Modify: `apps/mobile/package.json` (`expo-build-properties`; script `build:apk`), `apps/mobile/app.json` (→ `app.config` só se precisar; `version: "1.0.0"`, `android.versionCode: 1`, ícone, ícone adaptativo e splash com a cor de fundo do token de papel; plugin `["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]`), `.gitignore` (`apps/mobile/android/`, `dist/*.apk`)
- Create: `apps/mobile/assets/{icon.png, adaptive-icon.png, splash-icon.png}` gerados a partir do mascote Rabisco (`packages/design-tokens/src/mascot.ts`) por `apps/mobile/scripts/generate-icons.mjs` (renderização de SVG para PNG com uma lib dev, ex. `@resvg/resvg-js`; cores dos tokens), `apps/mobile/scripts/build-apk.mjs`, `apps/mobile/src/__tests__/appConfig.test.ts`

**Interfaces:**
- `npm run build:apk -w apps/mobile`: roda `npx expo prebuild --platform android --clean`, depois `android/gradlew assembleRelease` com `JAVA_HOME` = JDK 17 do Android Studio (se `JAVA_HOME` do sistema for Java 8, o script usa o do Android Studio e avisa) e `ANDROID_HOME` = `C:\Android\Sdk`; copia `android/app/build/outputs/apk/release/app-release.apk` para `dist/nivela-1.0.0.apk` na raiz. Mensagens do script em pt-BR; falha com mensagem clara se faltar JDK 17 ou SDK.
- Assinatura: o release do template do prebuild usa a chave de debug — aceitável para distribuição acadêmica; documentar no README que não serve para a Play Store.
- O `EXPO_PUBLIC_API_URL` do build vira só o endereço **padrão** (Task 2); o README explica o build com `EXPO_PUBLIC_API_URL=http://<ip>:8000/api/v1 npm run build:apk -w apps/mobile` ou trocando depois no app.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/android-apk`
- [ ] **Step 2: Teste que falha** — `appConfig.test.ts` lê a configuração do Expo (`app.json`/`getConfig`) e confere `usesCleartextTraffic: true`, `version` 1.0.0, `versionCode` 1, ícones existentes (Review Focus 4).
- [ ] **Step 3:** Implementar config, ícones e script → teste PASS; `expo export` passando.
- [ ] **Step 4: Verificação** — `npm run build:apk -w apps/mobile` gera `dist/nivela-1.0.0.apk`; instalar no emulador (`adb install -r`), configurar o servidor `10.0.2.2:8000` com a API rodando numa porta livre apontando para o `nivela_test`, entrar com um aluno criado por chamadas à API e abrir a Loja. Registrar o tamanho do APK e o resultado no relatório. Encerrar API e emulador que você iniciou.
- [ ] **Step 5: Commits** `feat(mobile): adiciona ícones e configuração do build android` · `build(mobile): adiciona o script de geração do apk`

---

### Task 4: Banco de demonstração

**Branch:** `feature/seed-demo`

**Files:**
- Create: `apps/api/prisma/seed-demo.ts`, `apps/api/prisma/demo/{questions.ts, plans.ts, rewards.ts, students.ts}` (dados), `apps/api/test/seed-demo.e2e-spec.ts`
- Modify: `apps/api/package.json` (script `db:seed:demo`), README (seção "Dados de demonstração" com logins)

**Interfaces:**
- `npm run db:seed:demo -w apps/api` usa o `DATABASE_URL` do `.env`. Exige que o admin do seed exista (senão: "Rode npm run db:seed antes."). Idempotente por marcador: se `ana.lima@nivela.test` já existe, não grava nada e diz "Os dados de demonstração já estão no banco.". Uma transação só (ou tudo, ou nada). Nunca altera o admin nem apaga nada.
- Senha de todas as contas de demonstração: `nivela123`. Conteúdo:
  - Professores: Ana Lima (`ana.lima@nivela.test`), Bruno Rocha (`bruno.rocha@nivela.test`).
  - Turmas: "9º ano A" (Ana, código `NIV-9ANO`), "1ª série B" (Bruno, código `NIV-1SER`).
  - Disciplinas: Matemática e Português (cores e ícones existentes dos tokens); categorias Matemática — Frações, Equações do 1º grau, Porcentagem; Português — Interpretação de texto, Ortografia, Concordância.
  - **24 questões originais** (4 por categoria), 5 alternativas, 1 correta, explicação curta, dificuldades variadas, escritas para o nivelamento 9º ano → Ensino Médio (sem copiar provas ou livros).
  - Planos publicados: "Revisão de Matemática para o Ensino Médio" (3 capítulos, bônus 50, atribuído às duas turmas) e "Leitura e escrita" (2 capítulos, bônus 30, atribuído ao 9º ano A).
  - 5 prêmios ativos com estoque: Caderno personalizado (120), Kit marca-texto (80), Vale-lanche da cantina (60), Adesivos do Rabisco (30), 15 minutos de leitura livre (40); 1 inativo.
  - 8 alunos (4 por turma, nomes fictícios, e-mails `aluno1@nivela.test`…`aluno8@nivela.test`) com histórico dos **últimos 14 dias** relativo à data da execução: tentativas em prática e capítulos (pelo menos 1 aluno com acerto < 50% e ≥ 5 terminadas, para "Precisam de ajuda"), moedas lançadas pelo `CoinLedger` com os mesmos motivos e `source_id` das regras (10/5 por acerto, bônus de plano, bônus de sequência), sequências coerentes, 1 plano concluído, resgates nos três estados (pendente, entregue, recusado com motivo e estorno).
- Timestamps das tentativas e movimentos gravados explicitamente nos dias do histórico, em horário de aula em Fortaleza.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/seed-demo`
- [ ] **Step 2: Testes que falham** (`seed-demo.e2e-spec.ts`, no `nivela_test`, chamando a função exportada do seed): cria tudo com as contagens acima; segunda execução não grava nada (Review Focus 5); sem admin → erro com a mensagem; invariantes: saldo de cada aluno = soma do extrato, estoque ≥ 0, cada resgate recusado tem um `refund`, `GET /dashboard/summary` como Ana mostra alunos e "precisam de ajuda" ≥ 1, `GET /dashboard/activity` tem dias com valores; login de `aluno1@nivela.test` com `nivela123` funciona.
- [ ] **Step 3:** FAIL → implementar → PASS (e2e, lint, typecheck). **Não** rodar no banco `nivela`; o usuário roda quando quiser (README).
- [ ] **Step 4: Commits** `feat(api): adiciona o seed de demonstração` · `test(api): cobre o seed de demonstração e seus invariantes`

---

### Task 5: Sobras do Plano 4 que aparecem na demonstração

**Branch:** `fix/plan4-leftovers`

**Files:**
- Modify: `packages/api-contract/src/plans.ts` (`ApiMyPlanSummary.progress.available_questions: number`), o presenter/serviço de `GET /me/plans` (`apps/api/src/modules/leveling-plans`), o cartão de plano do app (`apps/mobile/src/features/plans`), os 12 arquivos de `apps/web/src/features/rewards/**` e `packages/api-contract/src/rewards.ts` (só estilo)

**Interfaces:**
- `available_questions` = questões ativas somadas dos capítulos do plano (mesma regra do `chapters[].total` do detalhe). Cartão de "Meus planos" com `available_questions === 0` mostra "Sem questões disponíveis." no lugar de 100%.
- Estilo: aspas simples e quebra de linha como o resto do web (os arquivos foram reformatados com o Prettier padrão na onda final do Plano 4); commit só de estilo, sem mudar comportamento — `git diff -w` sem mudanças de lógica.

- [ ] **Step 1:** `git checkout develop && git checkout -b fix/plan4-leftovers`
- [ ] **Step 2: Testes que falham** — e2e: `/me/plans` com plano sem questões ativas traz `available_questions: 0`; mobile: cartão mostra "Sem questões disponíveis.".
- [ ] **Step 3:** FAIL → implementar → PASS; depois o commit de estilo com a suíte web verde.
- [ ] **Step 4: Commits** `fix(api): informa as questões disponíveis na lista de planos do aluno` · `fix(mobile): não mostra 100% em plano sem questões na lista` · `style(web): padroniza aspas e quebras da loja de prêmios`

---

### Task 6: Material do artigo — requisitos, UML, licença e textos

**Branch:** `feature/tcc-docs`

**Files:**
- Create: `LICENSE` (MIT, `Copyright (c) 2026 Henrique Douglas Cavalcante Costa`), `docs/requisitos.md`, `docs/uml/{casos-de-uso.md, classes.md, der.md}` (Mermaid) + `docs/uml/*.png` exportados, `docs/uml/README.md` (como regenerar), `docs/defesa/roteiro-video.md`, `docs/defesa/justificativa-stack.md`
- Modify: `"license": "MIT"` em todos os `package.json` (raiz, apps, packages), README (licença, links)

**Interfaces:**
- `requisitos.md`: RF numerados por perfil (a partir das §5.1/§5.2), RNF (§8) e RN01–RN15 (§7) — texto da spec, atualizado com o que foi construído (ex.: limite de tentativas, endereço configurável).
- UML: casos de uso (atores Administrador, Professor, Aluno; casos agrupados por área), classes (entidades do domínio e serviços centrais: `CoinLedger`, `StreakService`, `PlanCompletionService`, `RedemptionsService`), DER gerado do `schema.prisma` atual (todas as tabelas e FKs). PNG por `npx @mermaid-js/mermaid-cli` (tema claro, fundo branco).
- `roteiro-video.md`: 8–12 min, blocos com tempo: título e autor; justificativa; objetivos e etapas; ferramentas e métodos (XP + Kanban, gitflow, CI); demonstração (painel: login, questões com imagem, turma e código, plano em capítulos, Início com indicadores, loja e fila de resgates; app: cadastro com código, plano, resposta com moedas e sequência, loja e resgate, perfil com extrato); resultados; trabalhos futuros. Para cada tela, qual conta do seed de demonstração usar. Lembrete: o autor aparece no vídeo; YouTube não listado.
- `justificativa-stack.md`: 2–4 parágrafos prontos para a monografia sobre a troca Laravel → NestJS (monorepo 100% TypeScript, tipos compartilhados entre API, web e app, padrão já usado no estágio, ecossistema de testes) e a escolha de Prisma, React e Expo, citando versões de `docs/architecture.md`.

- [ ] **Step 1:** `git checkout develop && git checkout -b feature/tcc-docs`
- [ ] **Step 2:** Escrever os arquivos; gerar os PNG; conferir que o DER bate com `schema.prisma` (todas as tabelas).
- [ ] **Step 3:** `npm run lint` (arquivos de código intocados) e links do README conferidos.
- [ ] **Step 4: Commits** `docs: adiciona a licença mit` · `docs: adiciona requisitos e diagramas uml` · `docs: adiciona o roteiro do vídeo e a justificativa da stack`

---

### Task 7: Prints das telas

**Branch:** `feature/tcc-docs` (continuação; merge no fim)

**Files:**
- Create: `scripts/prints/web-prints.mjs` (Playwright, devDependency da raiz), `docs/prints/web/*.png`, `docs/prints/mobile/*.png`, `docs/prints/README.md` (lista das telas e como regenerar)

**Interfaces:**
- Dados: API numa porta livre contra o `nivela_test`, com o seed de demonstração da Task 4 aplicado (depois de os e2e terminarem); painel web numa porta livre (`CORS_ORIGINS` ajustado). Uploads num diretório temporário; imagens de prêmio e de 2 questões geradas a partir do mascote.
- Web (1440×900, tema claro): login, Início, questões (lista e formulário com imagem), turma (detalhe com desempenho), aluno (desempenho e extrato), plano (editor e progresso), loja (prêmios e resgates).
- Mobile (emulador, `adb exec-out screencap -p`): boas-vindas com o servidor, cadastro com código, Início com planos, capítulo, feedback com moedas, Estudar, Loja, confirmação do resgate, Meus resgates, Perfil com moedas.
- Ao terminar: encerrar servidores e emulador iniciados, apagar o temporário, `TRUNCATE` do `nivela_test` como os e2e fazem.

- [ ] **Step 1:** Script dos prints web → gerar → conferir cada PNG (tela certa, sem erro, sem dado quebrado).
- [ ] **Step 2:** Prints do app no emulador com o APK da Task 3 → conferir.
- [ ] **Step 3:** README com uma seção "Telas" apontando para `docs/prints/`.
- [ ] **Step 4: Commit** `docs: adiciona os prints do painel e do app`

---

### Task 8: Versão 1.0.0

**Branch:** `release/1.0.0`

**Files:**
- Modify: `version` `1.0.0` em todos os `package.json` (o `app.json` já está em 1.0.0), `CHANGELOG.md` (novo: 1.0.0 com o resumo por área, em pt-BR), backlog (Plano 5 marcado; o que sobrar vira "Trabalhos futuros"), `docs/workflow.md` se o processo de release precisar de nota

- [ ] **Step 1:** `git checkout develop && git checkout -b release/1.0.0`; versões e CHANGELOG; verificação completa: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build`, `expo export`, drift, `npm run build:apk -w apps/mobile`.
- [ ] **Step 2: Commit** `chore: prepara a versão 1.0.0`
- [ ] **Step 3 (controlador):** `git checkout main && git merge --no-ff release/1.0.0`, `git tag -s v1.0.0 -m "Nivela 1.0.0"`, `git checkout develop && git merge --no-ff release/1.0.0`; conferir assinatura (`git tag -v v1.0.0`, `git log --show-signature -1`).
- [ ] **Step 4 (controlador, só com autorização do usuário na conversa, uma pergunta por ação):** push de `main`, `develop` e da tag; `gh release create v1.0.0 dist/nivela-1.0.0.apk --title "Nivela 1.0.0" --notes-file` (notas do CHANGELOG); tornar o repositório público (`gh repo edit --visibility public --accept-visibility-change-consequences`). Conferir o CI de `main`.
