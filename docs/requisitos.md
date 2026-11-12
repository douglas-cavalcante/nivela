# Requisitos do Nivela

Documento de requisitos da versão 1.0.0, derivado da [especificação de design](superpowers/specs/2026-11-08-nivela-design.md) e atualizado com o que foi efetivamente construído. Os códigos (RF, RNF, RN) são estáveis e podem ser citados no artigo.

## 1. Perfis de usuário

| Perfil | Canal | Descrição |
|---|---|---|
| Administrador (`admin`) | Painel web | Faz tudo que o professor faz, sobre todos os dados, e cadastra, edita e desativa professores. A conta inicial é criada por seed. |
| Professor (`teacher`) | Painel web | Gerencia disciplinas, categorias, questões, as próprias turmas e os alunos delas, planos de nivelamento, prêmios e resgates. |
| Aluno (`student`) | App mobile | Cadastra-se com o código de uma turma, responde questões, segue planos, acumula moedas e resgata prêmios. |

O aluno não acessa o painel web, e professor e administrador não acessam o app: o login informa o canal (`web` ou `mobile`) e a API recusa o perfil fora do canal certo com mensagem clara.

## 2. Requisitos funcionais

### 2.1 Comuns a todos os perfis

| Código | Requisito |
|---|---|
| RF01 | Entrar no sistema com e-mail e senha, pelo canal do próprio perfil. |
| RF02 | Sair do sistema, revogando o token de acesso imediatamente. |
| RF03 | Trocar a própria senha. |
| RF04 | Alternar entre tema claro e escuro (painel web). |

### 2.2 Administrador

| Código | Requisito |
|---|---|
| RF05 | Cadastrar, editar e desativar professores. |
| RF06 | Executar todas as funções do professor (seção 2.3) sobre os dados de todos os professores. |

### 2.3 Professor (no painel web)

| Código | Requisito |
|---|---|
| RF07 | **Início:** ver os indicadores dos últimos 30 dias (alunos ativos, questões, taxa de acerto e alunos com acerto abaixo de 50%), a atividade dos últimos 14 dias (questões terminadas por dia de estudo), a lista de alunos que precisam de ajuda, as questões recentes e os resgates pendentes. |
| RF08 | **Disciplinas:** listar, criar e editar disciplinas (nome, cor e ícone). |
| RF09 | **Categorias:** listar por disciplina, criar e editar categorias. |
| RF10 | **Questões:** listar com filtros (disciplina, categoria, dificuldade e busca) e paginação. |
| RF11 | **Questões:** cadastrar e editar questão com enunciado, imagem opcional, cinco alternativas (A a E) com uma correta, explicação e dificuldade. |
| RF12 | **Questões:** ativar e desativar questão. |
| RF13 | **Turmas:** criar e editar as turmas das quais é responsável. |
| RF14 | **Turmas:** copiar e regenerar o código de entrada da turma. |
| RF15 | **Turmas:** ver os alunos da turma e cadastrar aluno manualmente. |
| RF16 | **Turmas:** ver o desempenho da turma por categoria (todo o histórico). |
| RF17 | **Alunos:** listar os alunos das suas turmas e abrir a ficha de cada um (desempenho por categoria, planos com progresso e extrato de moedas). |
| RF18 | **Planos:** criar plano de nivelamento (título, descrição, disciplina e bônus de conclusão). |
| RF19 | **Planos:** criar, ordenar e remover capítulos e selecionar as questões de cada capítulo a partir do banco de questões. |
| RF20 | **Planos:** publicar o plano e atribuí-lo a uma turma ou a um aluno, com prazo opcional. |
| RF21 | **Planos:** acompanhar o progresso dos alunos no plano. |
| RF22 | **Loja:** cadastrar e editar prêmios (nome, descrição, foto, preço, estoque e situação ativa) e desativá-los, sem excluí-los. |
| RF23 | **Loja:** ver a fila de resgates dos alunos do seu escopo, marcar resgate como entregue ou recusá-lo com motivo obrigatório. |

### 2.4 Aluno (no app mobile)

| Código | Requisito |
|---|---|
| RF24 | **Boas-vindas:** conhecer o app e escolher entre entrar ou se cadastrar com um código de turma. |
| RF25 | **Cadastro:** cadastrar-se informando nome, e-mail, senha e código de turma, validado pela API. |
| RF26 | **Servidor:** informar e alterar o endereço do servidor (API) dentro do app, sem recompilar. O app normaliza o endereço, testa a conexão antes de salvar, mantém o endereço anterior se o teste falhar e encerra a sessão ao trocar de servidor. |
| RF27 | **Início:** ver saudação, sequência de estudo, saldo de moedas e a lista de planos com progresso. |
| RF28 | **Plano:** ver os capítulos em ordem, com cadeado nos ainda bloqueados e progresso nos demais. |
| RF29 | **Questão:** ver enunciado, imagem e alternativas A a E e responder. |
| RF30 | **Feedback:** em caso de acerto, ver a animação, as moedas ganhas e a explicação; em caso de erro na primeira tentativa, tentar de novo; em caso de erro na segunda, ver a alternativa correta e a explicação. |
| RF31 | **Estudar:** praticar livremente por disciplina e categoria. |
| RF32 | **Loja:** ver a vitrine (preço e estoque), resgatar prêmio com confirmação e acompanhar "Meus resgates" com o status de cada um (pendente, entregue ou recusado). |
| RF33 | **Perfil:** ver dados e turmas, entrar em outra turma por código, ver o extrato de moedas e a melhor sequência, e sair. |

## 3. Regras de negócio

| Código | Regra |
|---|---|
| RN01 | Toda questão tem exatamente 5 alternativas (A a E) e exatamente 1 correta. |
| RN02 | Só o autor ou o administrador edita uma questão (a tentativa de outro professor recebe 403). Questão com tentativas registradas não é excluída, só desativada. Questões inativas não aparecem para alunos. Com tentativas registradas, a alternativa correta não pode ser trocada (409); o restante continua editável. |
| RN03 | O aluno tem no máximo 2 tentativas por questão, **por contexto** (capítulo de plano ou prática livre). |
| RN04 | Moedas por acerto: 10 na 1ª tentativa e 5 na 2ª. O aluno só ganha moedas na **primeira vez** que acerta cada questão, em qualquer contexto. |
| RN05 | A alternativa correta e a explicação só são enviadas ao app **depois** da resposta (acerto, ou 2ª tentativa errada). |
| RN06 | Um capítulo é concluído quando todas as suas questões **ativas** foram acertadas ou tiveram as 2 tentativas esgotadas; o estado é derivado (questão desativada depois não trava o aluno) e gravado de forma idempotente. Capítulo sem questão ativa conta como concluído se o anterior está concluído. O capítulo N+1 só é liberado depois de concluir o N (estados `locked`, `available` e `completed`). Responder em capítulo já concluído é aceito, sem novo bônus. |
| RN07 | Ao concluir o último capítulo, o plano é concluído e o aluno recebe o bônus de conclusão uma única vez. Plano sem capítulos nunca conclui, e o plano só conclui se o aluno terminou ao menos uma tentativa num capítulo dele. Na resposta da API, `chapter.completed` e `plan.completed` são eventos: verdadeiros só na resposta que concluiu. |
| RN08 | Plano só pode ser atribuído depois de publicado. Plano com progresso de alunos não pode ter capítulos ou questões removidos (409). |
| RN09 | Sequência de estudo: responder ao menos 1 questão em um dia (fuso `America/Fortaleza`) mantém ou incrementa a sequência; pular um dia a zera. A cada 7 dias consecutivos, o aluno recebe 20 moedas. Nas leituras, a sequência atual vale 0 quando o último dia de estudo foi há mais de um dia. |
| RN10 | Toda movimentação de moedas gera uma linha em `coin_transactions` e atualiza `coins_balance` na mesma transação do banco; a soma do extrato é sempre igual ao saldo, que nunca fica negativo. |
| RN11 | Resgate exige prêmio ativo, estoque maior que zero e saldo suficiente (409 "Prêmio esgotado." ou "Saldo insuficiente."). Débito, baixa de estoque e criação do pedido `pending` ocorrem numa única transação, com `SELECT … FOR UPDATE`. |
| RN12 | Resgate `pending` pode virar `delivered` ou `rejected` (motivo obrigatório). `rejected` devolve as moedas (`refund`, uma única vez por resgate, garantido por índice único) e o estoque. Estados finais não mudam (409). Prêmios não são excluídos, só desativados. |
| RN13 | Código de turma no formato `NIV-XXXX` (letras e números sem caracteres ambíguos), único; o professor pode regenerá-lo; turmas inativas não aceitam novos alunos. |
| RN14 | E-mail único no sistema. Usuário inativo não faz login. Senha com no mínimo 8 caracteres. |
| RN15 | O professor só vê e gerencia as próprias turmas, os alunos delas e os próprios planos; o administrador vê tudo. Recurso fora do escopo responde 404, para não confirmar que ele existe. |
| RN16 | Limite de tentativas: o login é limitado por IP e e-mail e o cadastro de aluno por IP, com limites configuráveis (`THROTTLE_LOGIN_LIMIT`, `THROTTLE_REGISTER_LIMIT` e `THROTTLE_TTL_SECONDS`; padrões de 10 e 30 tentativas por janela de 60 segundos). Ao estourar, a API responde 429 "Muitas tentativas. Aguarde um minuto e tente de novo." O limite do cadastro é folgado para que uma turma inteira possa se cadastrar pela mesma rede. |

As regras RN01 a RN15 vêm da especificação; a RN16 foi acrescentada na implementação.

### 3.1 Definições dos indicadores

| Indicador | Definição |
|---|---|
| Taxa de acerto | Calculada por questão **terminada** (acertada na 1ª ou 2ª tentativa, ou errada nas duas), contada uma vez por contexto: acertadas dividido por terminadas, em porcentagem inteira; sem questões terminadas, não há valor. Nunca é calculada por tentativa. |
| Atividade por dia | Questões terminadas por dia de estudo do término (fuso `America/Fortaleza`), com o total de acertadas; padrão de 14 dias. |
| Precisam de ajuda | Alunos ativos do escopo com ao menos 5 questões terminadas nos últimos 30 dias e taxa de acerto arredondada abaixo de 50%. |
| Janelas | Os números do Início usam os últimos 30 dias de estudo; o desempenho por categoria da turma e do aluno usa todo o histórico. |

## 4. Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Senhas com hash bcrypt; tokens de acesso guardados apenas como hash SHA-256 e revogados no logout; tokens expiram por inatividade e por idade (web: 7 e 30 dias; mobile: 30 e 180 dias). |
| RNF02 | Respostas da API em JSON com campos em `snake_case` e mensagens de erro em português do Brasil. |
| RNF03 | Interface web responsiva: confortável a partir de 1024 px e utilizável em tablet. |
| RNF04 | App compatível com Android (alvo principal) e iOS via Expo; entregue também como APK de release instalável. |
| RNF05 | Contraste WCAG AA e alvos de toque de pelo menos 44 px. |
| RNF06 | Código aberto no GitHub, sob licença MIT, com README de instalação. |
| RNF07 | A integração contínua executa lint, checagem de tipos, testes e build em cada push e pull request. |
| RNF08 | Autorização negada por padrão: toda rota não pública declara os perfis permitidos, verificado por teste automatizado. |
| RNF09 | Operações de moedas, resgates e conclusão de planos são transacionais e seguras contra concorrência (travas de linha e índices únicos parciais). |
| RNF10 | Dados de demonstração reproduzíveis por seed que apenas acrescenta registros e se recusa a rodar duas vezes. |

## 5. Fora do escopo da versão 1.0.0

Avaliação diagnóstica automática, notificações push, itens virtuais na loja, publicação nas lojas de aplicativos, implantação em produção, chat entre professor e aluno e recuperação de senha por e-mail.
