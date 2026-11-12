# Prints das telas

Capturas do painel web e do app mobile com os [dados de demonstração](../../README.md#dados-de-demonstração) (nomes fictícios, senha `nivela123`). Usadas no artigo e no vídeo.

## Painel web (1440 px, tema claro)

Pasta [web/](web/). Telas longas foram capturadas com a janela do tamanho da página inteira.

| Arquivo | Tela | Conta |
| --- | --- | --- |
| `01-login.png` | Login | (antes de entrar) |
| `02-inicio.png` | Início: indicadores, atividade dos 14 dias | `ana.lima@nivela.test` |
| `03-questoes.png` | Lista de questões | `ana.lima@nivela.test` |
| `04-questao-com-imagem.png` | Formulário de questão com imagem | `ana.lima@nivela.test` |
| `05-turma.png` | Turma "9º ano A": código, alunos e desempenho | `ana.lima@nivela.test` |
| `06-aluno.png` | Aluno: desempenho, planos e extrato de moedas | `ana.lima@nivela.test` |
| `07-plano-editor.png` | Plano de Matemática: capítulos e questões | `ana.lima@nivela.test` |
| `08-plano-progresso.png` | Plano de Matemática: progresso dos alunos (inclui a 1ª série B) | `admin@nivela.test` |
| `09-loja-premios.png` | Loja: prêmios com imagem, preço e estoque | `ana.lima@nivela.test` |
| `10-loja-resgates.png` | Loja: fila de resgates pendentes | `admin@nivela.test` |

## App mobile (emulador Pixel 4, API 31)

Pasta [mobile/](mobile/). Capturas feitas com o APK `dist/nivela-1.0.0.apk`, na resolução do emulador (1080 x 2280).

| Arquivo | Tela | Conta |
| --- | --- | --- |
| `01-boas-vindas.png` | Boas-vindas, com a linha "Servidor" | (sem login) |
| `02-cadastro-com-codigo.png` | Cadastro com o código `NIV-9ANO` | aluno novo |
| `03-inicio-planos.png` | Início com sequência, moedas e planos em andamento | `aluno2@nivela.test` |
| `04-plano-capitulos.png` | Plano: capítulo 1 liberado e os demais com cadeado | aluno novo |
| `05-questao.png` | Questão com alternativas | aluno novo |
| `06-tentar-de-novo.png` | Feedback de erro ("tentar de novo") | aluno novo |
| `07-acerto-com-moedas.png` | Acerto: moedas ganhas e explicação | aluno novo |
| `08-estudar.png` | Estudar: disciplinas | `aluno2@nivela.test` |
| `09-loja.png` | Loja: vitrine com saldo | `aluno1@nivela.test` |
| `10-resgate-confirmacao.png` | Confirmação do resgate | `aluno1@nivela.test` |
| `11-meus-resgates.png` | Meus resgates (pendentes e entregue) | `aluno1@nivela.test` |
| `12-perfil.png` | Perfil com saldo, sequência e extrato de moedas | `aluno1@nivela.test` |

## Como regenerar

Use sempre o banco de testes (`nivela_test`), nunca o `nivela`.

1. Banco limpo com administrador e dados de demonstração (o `DATABASE_URL` é o de `apps/api/.env.test`):

   ```bash
   # esvazie as tabelas como o resetDatabase dos e2e (TRUNCATE ... RESTART IDENTITY CASCADE)
   DATABASE_URL=<url do nivela_test> npm run db:seed -w apps/api
   DATABASE_URL=<url do nivela_test> npm run db:seed:demo -w apps/api
   ```

2. API e painel em portas livres (a API com um diretório de uploads temporário):

   ```bash
   cd apps/api && npm run build
   DATABASE_URL=<url do nivela_test> PORT=3101 UPLOADS_DIR=<pasta temporária> CORS_ORIGINS=http://localhost:5199 node dist/main
   cd apps/web && VITE_API_URL=http://localhost:3101/api/v1 npx vite --port 5199 --strictPort
   ```

3. Imagens de prêmios e questões (mascote) e prints do painel:

   ```bash
   npx tsx scripts/prints/seed-images.mjs
   npx playwright install chromium   # uma vez
   node scripts/prints/web-prints.mjs
   ```

   As variáveis `API_URL` e `WEB_URL` mudam os endereços (padrão `http://localhost:3101/api/v1` e `http://localhost:5199`).

4. Prints do app: suba o emulador (`emulator -avd Pixel_4_API_31`), instale o APK (`adb install -r dist/nivela-1.0.0.apk`), configure o servidor do app para `10.0.2.2:3101` ("Servidor · Alterar") e navegue pelas telas da tabela. Capture com `adb exec-out screencap -p > docs/prints/mobile/<arquivo>.png`. Para uma barra de status limpa: `adb shell settings put global sysui_demo_allowed 1` e os comandos `com.android.systemui.demo` (relógio, rede, bateria).

5. Ao terminar: encerre API, painel e emulador, apague a pasta de uploads e esvazie o `nivela_test` de novo.
