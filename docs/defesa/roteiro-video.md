# Roteiro do vídeo de apresentação

**Duração total: cerca de 11 minutos** (limite do orientador: de 8 a 12 minutos).

## Lembretes antes de gravar

- **O autor aparece no vídeo**, falando para a câmera, pelo menos na abertura e no encerramento (pode ser um canto da tela durante a demonstração).
- O vídeo é publicado no **YouTube como "não listado"**; o link vai no artigo e na entrega.
- Prepare o ambiente na véspera: Docker no ar, `npm run db:up`, API, painel web e emulador (ou celular) com o app. Rode o seed de demonstração **pouco antes de gravar**, porque o histórico é relativo ao dia da execução (`npm run db:seed:demo -w apps/api`; veja a seção "Dados de demonstração" do [README](../../README.md)).
- A senha de todas as contas de demonstração é `nivela123`. O administrador do seed é `admin@nivela.test`.
- Deixe o tema claro, a janela do painel em tela cheia (1280 px ou mais) e o app no emulador com o endereço do servidor já configurado ("Servidor · Alterar").
- Ensaie com cronômetro: os tempos abaixo somam 11 minutos, deixando um minuto de folga.

## Blocos

| # | Bloco | Tempo | Acumulado |
|---|---|---|---|
| 1 | Título e autor | 0:30 | 0:30 |
| 2 | Justificativa | 1:00 | 1:30 |
| 3 | Objetivos e etapas | 1:00 | 2:30 |
| 4 | Ferramentas e métodos | 1:30 | 4:00 |
| 5 | Demonstração (painel e app) | 5:30 | 9:30 |
| 6 | Resultados | 1:00 | 10:30 |
| 7 | Trabalhos futuros | 0:30 | 11:00 |

### 1. Título e autor (0:30)

Na tela: slide de abertura (ou a tela de login do painel) e o autor na câmera.

- Apresente-se: Henrique Douglas Cavalcante Costa.
- Diga o título: "Desenvolvimento de um sistema para apoio ao nivelamento estudantil".
- Nomeie o produto: **Nivela**, plataforma open source (licença MIT) com painel web para professores e app para alunos.

### 2. Justificativa (1:00)

- Após a pandemia, 7 em cada 10 alunos do Ensino Médio apresentam nível insuficiente em Língua Portuguesa e Matemática, o que afeta a preparação para ENEM, SPAECE e olimpíadas.
- A transição do Fundamental II para o Ensino Médio é o ponto em que as lacunas pesam.
- Falta uma ferramenta simples para o professor montar um percurso de nivelamento e acompanhar a turma, e que motive o aluno a voltar a estudar (moedas, sequência e prêmios).

### 3. Objetivos e etapas (1:00)

- **Objetivo geral:** desenvolver um sistema que apoie o nivelamento estudantil na transição do Fundamental II para o Ensino Médio.
- **Objetivos específicos:** banco de questões e planos de nivelamento por capítulos; estudo gamificado pelo celular; indicadores para o professor; código aberto e documentado.
- **Etapas:** levantamento de requisitos e especificação; arquitetura e modelagem (UML e DER); API; painel web; app mobile; estudo, moedas e planos; loja de prêmios e indicadores; dados de demonstração, APK e documentação.
- Mostre rapidamente o diagrama de casos de uso ([casos-de-uso.png](../uml/casos-de-uso.png)).

### 4. Ferramentas e métodos (1:30)

- **Métodos:** desenvolvimento incremental em ciclos curtos no estilo XP (testes junto do código, entregas pequenas) com quadro Kanban para acompanhar as tarefas; **gitflow** (`main`, `develop`, `feature/*`, `release/1.0.0`), commits no padrão Conventional Commits em português, assinados; **integração contínua** no GitHub Actions (lint, tipos, testes e build a cada push e pull request).
- **Ferramentas:** monorepo 100% TypeScript com npm workspaces; API em NestJS 12 com Prisma 7 e PostgreSQL 17; painel em React 19, Vite e Material UI; app em Expo (SDK 58) e React Native; testes com Jest, Vitest e jest-expo.
- Mostre o diagrama de classes ([classes.png](../uml/classes.png)) ou o DER ([der.png](../uml/der.png)) por alguns segundos e cite as regras críticas cobertas por testes (moedas, resgate, desbloqueio de capítulos e permissões). Detalhes na [justificativa da stack](justificativa-stack.md) e em [architecture.md](../architecture.md).

### 5. Demonstração (5:30)

Use os dados do seed de demonstração. Fale o que está acontecendo enquanto clica; não leia a tela.

#### 5.1 Painel web (3:00)

| Tempo | Tela | O que mostrar | Conta |
|---|---|---|---|
| 0:20 | Login | Entrar no painel; mencionar que aluno não entra no painel (e professor não entra no app). | `ana.lima@nivela.test` |
| 0:40 | Questões | Lista com filtros; abrir **Nova questão** e cadastrar uma questão **com imagem** (enunciado, 5 alternativas, 1 correta, explicação); desativar uma questão. | `ana.lima@nivela.test` |
| 0:30 | Turmas | Abrir "9º ano A": **código `NIV-9ANO`** (copiar), alunos da turma e desempenho por categoria. Deixe o código visível: ele é usado no cadastro do app. | `ana.lima@nivela.test` |
| 0:40 | Planos | Abrir o plano de Matemática: **capítulos em ordem**, questões de cada capítulo, mostrar a atribuição à turma e o progresso dos alunos (o plano já está publicado). O progresso da "1ª série B" nesse plano só aparece para o administrador (RN15). | `ana.lima@nivela.test`; para a 1ª série B, `admin@nivela.test` |
| 0:30 | Início | **Indicadores:** alunos ativos, taxa de acerto, resgates pendentes, gráfico de atividade dos últimos 14 dias e a lista "Precisam de ajuda" (aparece o `aluno4`). Explicar que a taxa é por questão terminada. | `ana.lima@nivela.test` |
| 0:20 | Loja | Aba **Prêmios** (preço e estoque) e aba **Resgates**: fila de pendentes; tratar **só o resgate pendente do `aluno6`** (entregar ou recusar com motivo). Não mexa nos resgates do `aluno5`: eles seguem mostrando os três estados (pendente, entregue e recusado, com o estorno das moedas) no app, em 5.2. Os dois alunos são da 1ª série B. | `bruno.rocha@nivela.test` (ou `admin@nivela.test`) |

#### 5.2 App mobile (2:30)

| Tempo | Tela | O que mostrar | Conta |
|---|---|---|---|
| 0:30 | Boas-vindas e cadastro | "Tenho um código de turma": cadastrar um aluno novo com o código `NIV-9ANO` (e-mail inédito, por exemplo `demo@nivela.test`, senha `nivela123`). Mostrar de passagem a linha "Servidor · Alterar". | aluno novo, criado na gravação |
| 0:50 | Plano e resposta | Com o **aluno recém-cadastrado** (turma NIV-9ANO), abrir o plano atribuído à turma: capítulo 1 disponível e os outros com cadeado. Responder uma questão **errando de propósito**, ver "tentar de novo", errar de novo (aparecem a correta e a explicação) e acertar outra: animação, **moedas** e **sequência**. Para mostrar um plano já andando, entre depois como `aluno2` (Pedro Henrique Alves): em Matemática o capítulo 1 está concluído, o 2 está disponível com 1 de 4 questões feitas e o 3 está bloqueado; em Português o capítulo 1 está concluído e o 2 disponível. | aluno novo; depois `aluno2@nivela.test` |
| 0:40 | Loja | Vitrine (preço e estoque), **resgatar** um prêmio com confirmação e "Meus resgates". Para resgatar, use a `aluno1` (saldo alto; por exemplo, o Caderno personalizado, 120 moedas); para mostrar os três estados (pendente, entregue e recusado), entre como `aluno5`. | `aluno1@nivela.test` e `aluno5@nivela.test` (Beatriz Carvalho) |
| 0:30 | Perfil | Dados, turmas, melhor sequência e **extrato de moedas**. Com a `aluno1` (Marina Souza: sequência de 14 dias, plano de Matemática concluído, resgates pendente e entregue); com a `aluno5`, o extrato mostra o estorno do resgate recusado. | `aluno1@nivela.test` ou `aluno5@nivela.test` |

Dica de edição: grave cada tela em separado e una os trechos; o login do app em trocas de conta é rápido, mas cortar a espera da API deixa o ritmo melhor.

### 6. Resultados (1:00)

- Os três apps (API, painel e app) funcionam de ponta a ponta e foram entregues com a versão 1.0.0, incluindo **APK de release** instalável (`dist/nivela-1.0.0.apk`).
- Todas as funcionalidades planejadas estão implementadas (requisitos RF01 a RF33; veja [requisitos.md](../requisitos.md)) e as regras de negócio RN01 a RN16 têm testes automatizados.
- CI verde; código aberto sob licença MIT; documentação (arquitetura, requisitos, UML, README com instruções de instalação e de geração do APK).
- Resultado de uso: o professor enxerga a turma (taxa de acerto, atividade, alunos que precisam de ajuda) e o aluno tem motivo para voltar (moedas, sequência, prêmios).
- Não há ainda teste com turmas reais; isso entra nos trabalhos futuros.

### 7. Trabalhos futuros (0:30)

- Aplicação em turmas reais e coleta de dados de uso.
- Avaliação diagnóstica automática que sugira o plano de cada aluno.
- Notificações push, itens virtuais na loja e publicação nas lojas de aplicativos.
- Implantação em produção, recuperação de senha por e-mail e chat entre professor e aluno.

Encerre com o autor na câmera, agradecendo e informando que o código está no GitHub (se o repositório já estiver público na data da entrega).
