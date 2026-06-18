# Project Instructions

Arcanum — coleção de skills (slash commands) do Claude Code, reutilizáveis entre projetos.

## Stack

Nenhuma linguagem de programação — o projeto é composto por arquivos markdown.

## Conventions

- Cada skill é uma pasta na raiz contendo um `SKILL.md` como entrypoint (carregado quando `/skill-name` é invocado) e arquivos markdown auxiliares opcionais, referenciados a partir do `SKILL.md`.
- O `SKILL.md` exige um frontmatter com `name` e `description`.
- Caminhos referenciados nas instruções (ex: "procure pelo arquivo X") devem ser relativos, nunca absolutos.
- Quando um caminho absoluto for necessário (ex: dentro de um script), ele deve ser extraído para uma variável em vez de repetido inline.
