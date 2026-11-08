# Nivela — Pendências levadas para os próximos planos

Saída das revisões do Plano 1 (fundação e autenticação). Cada plano seguinte começa lendo esta lista.

## Plano 2 — Cadastros (fazer ANTES de criar controllers novos)

1. **Precedência no `RolesGuard` (load-bearing).** Hoje `@AnyAuthenticated()`/`@Public()` declarados na **classe** + `@Roles(...)` num **handler** liberam o handler para qualquer logado (ou para qualquer pessoa). Metadata do handler deve vencer a da classe para as três chaves; adicionar teste "classe @AnyAuthenticated + handler @Roles(Admin) → aluno recebe 403". Nenhum controller atual usa decorator de classe.
2. **Pacote compartilhado `packages/api-contract`** (TS puro, como o design-tokens): `User`, `Role`, `ErrorBody`, `Paginated<T>` e `parseApiError` — hoje duplicados em web e mobile.
3. **Preset compartilhado de ESLint/Prettier** para web e mobile (configs ~95% iguais).
4. **Mensagens em inglês restantes no filtro de erros**: `ParseFilePipe` ("File is required"), `ParseArrayPipe`, `ParseUUIDPipe` — cobrir junto com o upload de imagens das questões.
5. **`JoinCodeService.generate`** é check-then-insert: criar/regenerar turma deve tratar P2002 em `classrooms_join_code_key` e tentar de novo (usar `isUniqueViolation`).
6. **`PasswordField` (web)** descarta `slotProps.input` do chamador — corrigir ao movê-lo para `src/components` (formulário de professor do admin).
7. `revokeOthers(userId)` sem token a manter revoga tudo — reutilizar ao **desativar professor**.
8. `deleteMany` de token expirado sem try/catch (o write de `last_used_at` já é protegido).
9. Code-splitting por rota no web (bundle > 500 kB) quando as páginas do Plano 2 entrarem.

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

## Pequenos (quando passar perto)

- Web: `getMe`/`logout` sem uso na feature `auth`; sem teste de `signOut` com `/me` pendente; inputs do login sem `aria-describedby` para o alerta; alerta de sucesso do Perfil persiste; `autoComplete="username"` → `email`; teste de rota aninhada ativa no menu; regex de hex pega strings como `'#add'`; `favicon.svg` com hex manual.
- Mobile: `getMe`/`logout` sem uso; `setLeaving` após desmontar.
- API: transformer ESM do Jest com regex e chave de cache fixa (subir `esm-transformer-v1` ao mudar); `moduleNameMapper` do e2e duplicado; `MaxLength(72)` conta caracteres, não bytes.
- Tokens: `contrastRatio` não aceita hex de 3 dígitos; testes de `spacing`/`radius`/`penShadow`.
