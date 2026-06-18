# Architecture

## Overview

Este repositório não tem uma arquitetura de aplicação no sentido tradicional — não há processo em execução, nem camadas de runtime. Cada skill é um conjunto de instruções em markdown que o Claude Code carrega e interpreta quando o usuário invoca `/skill-name`.

## Source Code Layout

Cada skill vive em sua própria pasta na raiz do repositório:

```
skill-name/
├── SKILL.md          ← entry point, carregado quando /skill-name é invocado
├── step-one.md        ← instruções auxiliares, referenciadas a partir do SKILL.md
└── step-two.md
```

- `SKILL.md` exige um frontmatter com `name` e `description`.
- Skills mais simples podem ter apenas o `SKILL.md`, sem arquivos auxiliares.
- Skills mais complexas dividem o fluxo em múltiplos arquivos markdown (ex: um por cenário ou por passo), referenciados via links relativos a partir do `SKILL.md`.

## Lógica determinística

Sempre que uma skill precisar de lógica determinística (parsing, validação, manipulação de arquivos), prefira extrair essa lógica para um script (ex: shell, dentro da própria pasta da skill) em vez de descrevê-la em linguagem natural. Isso evita ambiguidade de interpretação e reduz o consumo de tokens em cada execução.
