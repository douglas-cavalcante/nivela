# Changelog

Todas as mudanças relevantes do Nivela. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [versionamento semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-11-12

Primeira versão completa do Nivela, reunindo os cinco planos de desenvolvimento (base, cadastros, estudo, loja e indicadores, entrega).

### API

- Autenticação por token com perfis de administrador, professor e aluno; permissões por perfil com deny-by-default; cadastro de aluno com código de turma e troca de senha.
- Limite de tentativas no login (por IP e e-mail) e no cadastro (por IP), com limites configuráveis e resposta 429 em português.
- Cadastros de professores, disciplinas, categorias, questões (alternativas, uma correta, imagem validada por assinatura, busca textual), turmas (código de entrada único), matrícula e alunos.
- Planos de nivelamento por capítulos: montagem, publicação, atribuição a turmas e alunos, desbloqueio de capítulos, progresso e bônus de conclusão pago uma vez.
- Estudo: respostas com segunda tentativa, moedas, extrato com crédito único e sequência de estudo no fuso de Fortaleza; prática livre por disciplina.
- Loja de prêmios (catálogo com foto e estoque), resgates com saldo e estoque travados no banco, fila da equipe com entrega e recusa com estorno único das moedas.
- Indicadores do Início (acerto, atividade por dia, alunos que precisam de ajuda), desempenho por categoria da turma e do aluno e extrato de moedas.
- Seed de demonstração (`npm run db:seed:demo -w apps/api`) que só acrescenta dados e se recusa a rodar duas vezes.
- Migrações Prisma sem drift, testes unitários e e2e contra o banco de testes.

### Painel web

- Login, Início com indicadores, e telas de professores, disciplinas, categorias, banco de questões (filtros, imagem, ativar e desativar), turmas com código, alunos e planos com capítulos.
- Atribuição de planos e acompanhamento do progresso, ficha do aluno com planos, extrato de moedas e desempenho por categoria.
- Loja de prêmios (catálogo com foto) e fila de resgates com entrega e recusa.

### App mobile (aluno)

- Cadastro com código de turma, entrada em outras turmas pelo código, perfil com turmas, moedas, melhor sequência, extrato e troca de senha.
- Prática por disciplina com feedback e segunda tentativa, planos por capítulos, moedas e sequência de estudo no Início.
- Loja de prêmios com resgate e acompanhamento dos resgates.
- Endereço do servidor configurável no aparelho ("Servidor · Alterar" nas telas Boas-vindas e Entrar e botão "Alterar servidor" na tela de falha de conexão), com teste de conexão antes de salvar; trocar de servidor encerra a sessão.
- APK de release gerado localmente (`npm run build:apk -w apps/mobile`), com HTTP liberado para a rede local.

### Documentação

- README, arquitetura, estrutura de pastas, fluxo de trabalho (gitflow, Conventional Commits, CI), especificação de design e requisitos.
- Roteiro do vídeo de defesa, justificativa da troca Laravel → NestJS, diagramas UML e prints das telas.
- Licença MIT.

### Instalação do APK

O endereço padrão do servidor embutido no APK de release é `http://10.0.2.2:8000/api/v1`, que é o `localhost` do computador visto de dentro do emulador Android. Em um celular físico, abra o app, toque em **Servidor · Alterar** e informe o IP da máquina que roda a API na mesma rede Wi-Fi (por exemplo `192.168.0.10:8000`); a porta 8000 precisa estar liberada no Firewall. Veja "Gerar o APK" no [README](README.md).

[1.0.0]: https://github.com/douglas-cavalcante/nivela/releases/tag/v1.0.0
