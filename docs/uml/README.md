# Diagramas UML

Os diagramas são escritos em [Mermaid](https://mermaid.js.org/) e exportados em PNG (tema claro, fundo branco) para uso no artigo.

| Diagrama | Fonte | Página | Imagem |
|---|---|---|---|
| Casos de uso | `casos-de-uso.mmd` | [casos-de-uso.md](casos-de-uso.md) | `casos-de-uso.png` |
| Classes (domínio) | `classes.mmd` | [classes.md](classes.md) | `classes.png` |
| Classes (serviços centrais) | `classes-servicos.mmd` | [classes-servicos.md](classes-servicos.md) | `classes-servicos.png` |
| DER | `der.mmd` | [der.md](der.md) | `der.png` |

Os arquivos `.mmd` são a fonte; os `.md` repetem o mesmo código num bloco `mermaid` (o GitHub o desenha direto) e embutem o PNG. Ao alterar um diagrama, edite o `.mmd`, copie o conteúdo para o bloco do `.md` correspondente e regenere o PNG.

## Como regenerar os PNG

Na pasta `docs/uml`, para cada diagrama (a primeira execução baixa um Chrome headless):

```bash
npx -y @mermaid-js/mermaid-cli@11 -i casos-de-uso.mmd -o casos-de-uso.png -b white -s 2 -w 1600
npx -y @mermaid-js/mermaid-cli@11 -i classes.mmd -o classes.png -b white -s 2 -w 1600
npx -y @mermaid-js/mermaid-cli@11 -i classes-servicos.mmd -o classes-servicos.png -b white -s 2 -w 1600
npx -y @mermaid-js/mermaid-cli@11 -i der.mmd -o der.png -b white -s 2 -w 1600
```

`-s 2` dobra a resolução para o PNG ficar nítido ao ser ampliado no documento.

## Conferindo o DER

O `der.mmd` deve listar todas as tabelas (`@@map` dos models) e todas as chaves estrangeiras do `apps/api/prisma/schema.prisma`. Ao mudar o schema, atualize o diagrama.
