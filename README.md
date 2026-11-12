# Nivela

Plataforma open source de apoio ao **nivelamento estudantil** na transição do Ensino Fundamental II para o Ensino Médio. Professores cadastram questões e montam planos de nivelamento no painel web; alunos estudam pelo celular de forma gamificada (moedas, sequência de estudo e loja de prêmios).

Trabalho de Conclusão de Curso — **Henrique Douglas Cavalcante Costa**.

Integração contínua: [workflow de CI](.github/workflows/ci.yml) (lint, tipos, testes e build em todo push e pull request; detalhes em [docs/workflow.md](docs/workflow.md)).

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/api` | API NestJS 12 + Prisma 7 + PostgreSQL |
| `apps/web` | Painel web (React + Vite) para professor/admin |
| `apps/mobile` | App mobile (Expo) para o aluno |
| `packages/design-tokens` | Tokens de design compartilhados |
| `packages/api-contract` | Tipos de resposta da API e `parseApiError`, compartilhados |
| `docs/` | Documentação e especificação |

**O que o sistema faz na versão 1.0.0**

- **Painel web (professor e administrador):** login, cadastro de professores, disciplinas, categorias, questões (com imagem), turmas (com código de entrada) e alunos; planos de nivelamento por capítulos, com atribuição às turmas e acompanhamento do progresso; loja de prêmios (com foto) e fila de resgates (entregar ou recusar com estorno das moedas); no Início, indicadores de acerto, atividade por dia e alunos que precisam de ajuda, além do desempenho por categoria nas fichas da turma e do aluno.
- **App mobile (aluno):** cadastro com código de turma, entrada em outras turmas pelo código, prática por disciplina com feedback e segunda tentativa, planos por capítulos, moedas, extrato, sequência de estudo, loja de prêmios com resgate e acompanhamento dos resgates, perfil com troca de senha e endereço do servidor configurável.
- **API:** NestJS com autenticação por token, permissões por perfil (deny-by-default), limite de tentativas no login e no cadastro, e seed de demonstração com dados prontos para gravar o vídeo.

## Pré-requisitos

- Docker Desktop (aberto antes de `npm run db:up`)
- Node 22 (`.nvmrc`) e npm 10. O Node 22.14 funciona: o workspace usa a CLI 11 do Nest, que compila o mesmo projeto (a CLI 12 pede Node 22.22.3 ou mais novo; detalhes em [docs/architecture.md](docs/architecture.md#notas-sobre-typescript-e-ferramentas-da-api)).

## Como rodar

Todos os comandos na raiz do repositório (Git Bash no Windows).

```bash
# 1. Dependências de todos os workspaces (também gera o client do Prisma)
npm install

# 2. Banco de dados: PostgreSQL 17 no Docker, porta 5433 (bancos nivela e nivela_test)
npm run db:up

# 3. Variáveis de ambiente de cada app
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env

# 4. Estrutura do banco (migrations) e administrador inicial
npm run db:deploy -w apps/api
npm run db:seed -w apps/api

# 5. Cada app em um terminal
npm run dev:api      # http://localhost:8000/api/v1 · Swagger em http://localhost:8000/docs
npm run dev:web      # http://localhost:5173
npm run dev:mobile   # Expo: emulador Android ou Expo Go
```

**Primeiro acesso:** entre no painel web com o administrador criado pelo seed, cujas credenciais vêm de `apps/api/.env.example`:

- e-mail: `admin@nivela.test`
- senha: `nivela123`

Troque a senha em **Perfil** no primeiro acesso.

**App no celular:** o `apps/mobile/.env` vem com `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1`, que é o `localhost` da máquina visto de dentro do **emulador Android**. Em um **celular físico** (Expo Go), use o IP da sua máquina na rede, por exemplo `http://192.168.0.10:8000/api/v1` (veja o IP com `ipconfig`), com celular e computador no mesmo Wi-Fi. No Windows, o **Firewall do Windows** precisa permitir conexões de entrada na porta **8000** (a API escuta em `0.0.0.0:8000`); sem isso o app mostra "Sem conexão com o servidor." Depois de mudar o `.env`, reinicie o Expo. **Sem mexer no `.env`:** nas telas de Boas-vindas e Entrar, a linha "Servidor: … · Alterar" permite digitar o endereço da API (por exemplo `192.168.0.10:8000`); o app completa `http://` e `/api/v1`, testa a conexão (`GET /health`) antes de salvar e guarda o endereço no aparelho. Trocar de servidor encerra a sessão aberta, e "Usar o padrão" volta ao `EXPO_PUBLIC_API_URL`. Assim um mesmo APK funciona em qualquer rede Wi-Fi.

**Variáveis da API** (`apps/api/.env`, modelo em `.env.example`):

| Variável | Para que serve |
|---|---|
| `PORT`, `DATABASE_URL`, `TZ` | porta da API, conexão com o PostgreSQL e fuso horário |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | administrador criado pelo seed |
| `UPLOADS_DIR` | pasta das imagens enviadas (padrão `uploads`, relativa a `apps/api`), servida em `/uploads`; a API devolve o caminho relativo (`/uploads/questions/...`) e cada app o resolve com o próprio endereço da API |
| `CORS_ORIGINS` | origens liberadas no CORS, separadas por vírgula (opcional) |
| `THROTTLE_LOGIN_LIMIT` | tentativas de login por janela, para cada par IP + e-mail (padrão 10) |
| `THROTTLE_REGISTER_LIMIT` | cadastros de aluno por janela, para cada IP (padrão 60, folgado para uma turma inteira na mesma rede) |
| `THROTTLE_TTL_SECONDS` | duração da janela do limite, em segundos (padrão 60) |

> **Outra porta no web:** o CORS padrão só libera o Vite em `http://localhost:5173` (e o Expo web em 8081/19006). Se subir o painel em outra porta (por exemplo `npm run dev:web -- --port 5174`), defina `CORS_ORIGINS=http://localhost:5174` no `apps/api/.env` e reinicie a API; o mesmo vale para acessar o painel pelo IP da máquina. Se mudar a porta da API, ajuste também `VITE_API_URL` e `EXPO_PUBLIC_API_URL`.

Se `VITE_API_URL` (web) ou `EXPO_PUBLIC_API_URL` (mobile) não estiver definida, o app falha logo ao abrir com uma mensagem dizendo qual `.env` copiar.

## Testando o fluxo do aluno

Com API, web e (opcionalmente) o app rodando e o administrador do seed:

1. No painel web (`http://localhost:5173`), entre como administrador e crie uma **disciplina** e uma **categoria** em **Disciplinas** e **Categorias**.
2. Em **Questões**, cadastre pelo menos 3 questões da disciplina (5 alternativas, 1 correta, com explicação).
3. Em **Turmas**, crie uma turma e copie o **código** (`NIV-XXXX`).
4. Em **Planos**, crie um plano (disciplina, bônus de conclusão), adicione 2 capítulos com questões, **publique** e, na aba **Atribuições**, atribua à turma.
5. No app (emulador ou Expo Go), toque em **Tenho um código de turma**, cadastre o aluno com o código e entre.
6. No **Início**, abra o plano: o capítulo 1 está disponível e o 2 trancado. Responda uma questão errando duas vezes (a correção e a explicação aparecem só no fim), acerte as outras (10 moedas na 1ª tentativa, 5 na 2ª) e conclua o capítulo 1; o 2 é liberado. Concluindo o 2, o plano termina e o bônus entra no saldo.
7. Em **Estudar**, pratique por disciplina; moedas e sequência (conta o dia em `America/Fortaleza`) aparecem na barra do topo.
8. No painel, abra o plano e veja o **Progresso** da turma.

## Testando a loja e os relatórios

Com API, web e o app rodando, e o fluxo do aluno acima já feito (um aluno com moedas):

1. No painel, em **Loja**, aba **Prêmios**, crie um prêmio com preço que o aluno consiga pagar e estoque 2 (a foto é opcional).
2. No app, abra a aba **Loja** e resgate o prêmio, confirmando. O saldo cai, o estoque baixa e o resgate aparece em **Meus resgates** como pendente.
3. No painel, em **Loja**, aba **Resgates**, recuse o resgate informando o motivo. No app, o extrato de moedas (Perfil) mostra o estorno, o saldo volta e o estoque do prêmio também.
4. No app, resgate o prêmio de novo.
5. No painel, entregue esse resgate: no app ele passa a "Entregue".
6. No **Início** do painel, veja os cards (alunos ativos, taxa de acerto, resgates pendentes), o gráfico de atividade do dia e a lista de alunos que precisam de ajuda. Ela só se preenche depois de um aluno ter 5 questões terminadas nos últimos 30 dias com acerto abaixo de 50% (por exemplo, errando de propósito no app). Na ficha da turma e na do aluno, veja o desempenho por categoria; na do aluno, também o extrato de moedas.

## Dados de demonstração

Para gravar o vídeo ou tirar capturas de tela com o sistema "vivo", há um seed de demonstração: 2 professores, 2 turmas, Matemática e Português, 24 questões originais (9º ano para o Ensino Médio), 2 planos publicados, 5 prêmios ativos e 8 alunos com 14 dias de histórico (tentativas, moedas, sequências, um plano concluído e resgates pendentes, entregues e recusados).

```bash
npm run db:seed -w apps/api        # o administrador precisa existir antes
npm run db:seed:demo -w apps/api   # usa o DATABASE_URL do apps/api/.env
```

O seed só **acrescenta** dados, numa transação (ou grava tudo, ou nada), e nunca altera o administrador. Se `ana.lima@nivela.test` já existe, ele avisa "Os dados de demonstração já estão no banco." e não grava nada. O histórico é relativo ao dia da execução: rode o seed pouco antes de gravar o vídeo. Para repetir com datas novas, aponte o `DATABASE_URL` para um banco limpo.

Se o banco já tem disciplinas ou categorias com os mesmos nomes (sem diferenciar maiúsculas), como "Matemática", o seed as **reaproveita** e cria só as que faltam. Se algum código de turma (`NIV-9ANO`, `NIV-1SER`) ou e-mail de demonstração já existe, ele recusa antes de gravar e diz quais são. A turma "1ª série B" pertence ao professor Bruno e o plano de Matemática à Ana, então o progresso da 1ª série B nesse plano só aparece na conta de administrador (RN15): para mostrá-lo no vídeo, entre como administrador.

A senha de todas as contas de demonstração é `nivela123`.

| Perfil | E-mail | Observação |
| --- | --- | --- |
| Professora | `ana.lima@nivela.test` | turma "9º ano A" (código `NIV-9ANO`) |
| Professor | `bruno.rocha@nivela.test` | turma "1ª série B" (código `NIV-1SER`) |
| Aluna | `aluno1@nivela.test` | Marina Souza, 9º ano A: sequência de 14 dias e plano de Matemática concluído |
| Alunos | `aluno2@nivela.test` a `aluno4@nivela.test` | 9º ano A (o `aluno4` aparece em "Precisam de ajuda") |
| Alunos | `aluno5@nivela.test` a `aluno8@nivela.test` | 1ª série B (o `aluno5` tem os três estados de resgate) |

## Segurança da demonstração

- O tráfego entre o app e a API é **HTTP sem criptografia**. Use-o só em rede confiável, durante a demonstração: o APK libera HTTP para qualquer endereço (o Android não permite restringir por faixa de IP). Em produção, sirva a API por **HTTPS**.
- As contas de demonstração e a senha `nivela123` servem só para demonstração; não as use em um ambiente real.
- O seed de demonstração só acrescenta dados e não tem remoção. Para gravar o vídeo, prefira um banco separado do que você usa no dia a dia.

## Telas

Capturas do painel web e do app mobile, com os dados de demonstração, em [docs/prints/](docs/prints/) (a lista de telas e o passo a passo para regenerar estão em [docs/prints/README.md](docs/prints/README.md)).

## Gerar o APK

O app pode ser empacotado em um APK de release, instalável em qualquer celular Android sem a Play Store. O build é local (Expo prebuild + Gradle), pelo script `apps/mobile/scripts/build-apk.mjs`:

```bash
npm run build:apk -w apps/mobile
```

O arquivo sai em `dist/nivela-1.0.0.apk` (a versão vem do `app.json`; a pasta `dist/` não vai para o git). A primeira execução leva vários minutos, porque o Gradle baixa as dependências.

**Requisitos**

- **JDK 17.** O script usa o `JAVA_HOME` se ele apontar para um JDK 17; senão, usa o `jbr` do Android Studio (`C:/Program Files/Android/Android Studio/jbr`). Sem nenhum dos dois, ele para com uma mensagem.
- **Android SDK com a plataforma 35** instalada (pelo SDK Manager do Android Studio). O script procura em `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `%LOCALAPPDATA%\Android\Sdk` (local padrão do Android Studio) e `C:/Android/Sdk`.
- **`EXPO_PUBLIC_API_URL`**, vinda do ambiente ou de `apps/mobile/.env`, é o endereço **padrão** da API embutido no APK (o app o troca depois em "Servidor · Alterar", veja abaixo). Sem nenhum dos dois, o script para com uma mensagem; ele imprime o endereço que vai embutir.

**Windows: caminhos longos.** O Windows limita caminhos a 260 caracteres, e o build do React Native em monorepo gera caminhos maiores que isso. O `ninja` 1.10 que vem com o CMake do Android SDK não consegue contornar o limite, então o build falha. A solução é usar um CMake 3.31 ou mais novo com um ninja 1.12 ou mais novo, instalados em uma **pasta curta fora do repositório** (aqui, `C:\Android\cmake-long`):

```bash
pip install --target 'C:\Android\cmake-long' cmake==3.31.6 ninja==1.13.0
cp 'C:\Android\cmake-long\bin\ninja.exe' 'C:\Android\cmake-long\cmake\data\bin\'
```

O CMake de verdade fica em `C:\Android\cmake-long\cmake\data\bin\cmake.exe` (a pasta `C:\Android\cmake-long\bin` só tem um lançador que não funciona sozinho); por isso o `ninja.exe` é copiado para a mesma pasta `bin` do CMake real. Depois, aponte `CMAKE_DIR` para a pasta que contém esse `bin` e gere o APK (troque `<ip>` pelo IP da máquina na rede; se `apps/mobile/.env` já tiver `EXPO_PUBLIC_API_URL`, pode omiti-la):

```bash
CMAKE_DIR='C:\Android\cmake-long\cmake\data' EXPO_PUBLIC_API_URL=http://<ip>:8000/api/v1 npm run build:apk -w apps/mobile
```

O script confere se `CMAKE_DIR\bin\cmake.exe` existe e, depois do `prebuild`, grava `cmake.dir` no `local.properties` do projeto Android para o Gradle usar esse CMake. Ele também ajusta sozinho o `JAVA_TOOL_OPTIONS` (diretório temporário sem espaço em `SystemRoot\Temp`), que evita o erro "Unable to establish loopback connection" do Gradle quando o nome do usuário do Windows tem espaço.

**O que o APK contém**

- ABIs **arm64-v8a** (celulares atuais) e **x86_64** (emulador). Não há versão de 32 bits (`armeabi-v7a`), então celulares Android muito antigos não são suportados.
- Assinado com a **chave de debug**: serve para instalar e demonstrar, **não para publicar na Play Store**.
- Libera tráfego HTTP sem TLS (`usesCleartextTraffic`), para falar com a API pelo IP da rede local.

**Instalar**

- Pelo computador, com o celular em modo desenvolvedor e depuração USB (ou com o emulador aberto): `adb install -r dist/nivela-1.0.0.apk`.
- Ou copie o arquivo para o celular (cabo, nuvem ou mensageiro) e abra-o, permitindo a instalação de fontes desconhecidas quando o Android pedir.

**Apontar o app para o servidor.** Na primeira abertura, nas telas de Boas-vindas ou Entrar, toque em **Servidor · Alterar** e digite o endereço da API, por exemplo `192.168.0.10:8000`. O app completa `http://` e `/api/v1`, testa a conexão antes de salvar e encerra a sessão ao trocar de servidor. Celular e computador precisam estar no mesmo Wi-Fi, com a API rodando e a porta 8000 liberada no Firewall do Windows.

## Testes e outros comandos

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`: rodam em todos os workspaces.
- `npm run test:e2e -w apps/api`: aplica as migrations no banco `nivela_test` (`prisma migrate deploy`) e roda os testes e2e; entre os testes, as tabelas são esvaziadas (`TRUNCATE`). O banco não é recriado, e o script se recusa a rodar se o banco não terminar em `_test`.
  - Um `DATABASE_URL` exportado no terminal **prevalece** sobre o `apps/api/.env.test` (é assim que o CI aponta para o banco dele). A trava do `_test` protege o banco de desenvolvimento: se o `DATABASE_URL` exportado apontar para `nivela`, os e2e se recusam a rodar.
- `npm run db:migrate -w apps/api`: cria uma migration nova durante o desenvolvimento (`prisma migrate dev`).
- `npm run db:down`: para o banco (os dados ficam em `docker/pgdata/`).
- Os mesmos passos do CI, localmente: `npm ci && npm run lint && npm run typecheck && npm test && npm run test:e2e -w apps/api && npm run build`.

## Documentação

- [Arquitetura](docs/architecture.md)
- [Estrutura de pastas](docs/estruturaDePastas.md)
- [Fluxo de trabalho (git e commits)](docs/workflow.md)
- [Especificação de design](docs/superpowers/specs/2026-11-08-nivela-design.md)
- [Requisitos (RF, RNF e RN)](docs/requisitos.md)
- [Diagramas UML](docs/uml/README.md): [casos de uso](docs/uml/casos-de-uso.md), [classes](docs/uml/classes.md), [serviços centrais](docs/uml/classes-servicos.md) e [DER](docs/uml/der.md)
- [Roteiro do vídeo de apresentação](docs/defesa/roteiro-video.md)
- [Justificativa da escolha das tecnologias](docs/defesa/justificativa-stack.md)

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
