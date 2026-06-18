# Project Instructions

Arcanum — coleção de skills (slash commands) do Claude Code, reutilizáveis entre projetos.

## Stack

Nenhuma linguagem de programação — o projeto é composto por arquivos markdown.

## Conventions

- Cada skill é uma pasta na raiz contendo um `SKILL.md` como entrypoint (carregado quando `/skill-name` é invocado) e arquivos markdown auxiliares opcionais, referenciados a partir do `SKILL.md`.
- O `SKILL.md` exige um frontmatter com `name` e `description`.
- Caminhos referenciados nas instruções (ex: "procure pelo arquivo X") devem ser relativos, nunca absolutos.
- Quando um caminho absoluto for necessário (ex: dentro de um script), ele deve ser extraído para uma variável em vez de repetido inline.
- Sempre que possível, extrair lógica das skills para scripts (em vez de instruções em linguagem natural), para tornar o comportamento determinístico e reduzir consumo de tokens.

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Source layout, modules, code style, and implementation guidelines. |
| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

Example: `docs/agents/issues/5_release_docker_image.md` for issue #5.

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.
