# Flow

## Overview

Não há um runtime contínuo: o "fluxo" deste projeto é o ciclo de vida de uma skill sendo invocada pelo Claude Code.

1. O usuário digita `/skill-name` (com argumentos opcionais).
2. O Claude Code carrega o `SKILL.md` correspondente.
3. As instruções do `SKILL.md` são seguidas passo a passo, podendo referenciar e carregar arquivos markdown auxiliares conforme o cenário detectado.
4. Quando a skill precisa de lógica determinística (ex: ler/escrever arquivos, validar formato), ela invoca um script em vez de raciocinar sobre a tarefa em linguagem natural.
5. A skill termina ao completar todos os passos descritos, opcionalmente confirmando o resultado com o usuário.
