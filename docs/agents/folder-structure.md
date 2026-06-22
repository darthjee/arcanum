# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `auto-new-issue/` | Skill `/auto-new-issue` — cria um novo arquivo de issue de forma autônoma (sem interação com o usuário), comitando e sincronizando com o GitHub automaticamente. |
| `auto-plan-issue/` | Skill `/auto-plan-issue` — escreve o plano de implementação de uma issue de forma autônoma, dividindo entre agentes especialistas quando existirem. |
| `auto-fix-issue/` | Skill `/auto-fix-issue` — implementa uma issue planejada de forma autônoma, despachando agentes especialistas em paralelo e abrindo/marcando pronto o PR. |
| `auto-fix-all/` | Skill `/auto-fix-all` — orquestra o pipeline completo (issue → plano → fix → monitoramento) para uma fila de IDs, um por vez, reagindo a comentários, aprovações, falhas de CI e fechamentos de PR até esvaziar a fila. |
| `init-claude/` | Skill `/init-claude` — configura AGENTS.md/CLAUDE.md/copilot-instructions.md e a estrutura de docs do projeto. |
| `new-issue/` | Skill `/new-issue` — cria um novo arquivo de issue. |
| `plan-issue/` | Skill `/plan-issue` — cria o plano de implementação de uma issue existente. |
| `push-issue-to-queue/` | Skill `/push-issue-to-queue` — adiciona um ou mais ids de issue ao final da fila do `auto-fix-all`. |
| `docs/agents/` | Documentação do próprio repositório (arquitetura, fluxo, issues, plans). |
| `.github/` | Contém `copilot-instructions.md`, que aponta para AGENTS.md. |
| `.claude/` | Configuração local do Claude Code para este repositório. |
| `AGENTS.md` | Instruções compartilhadas do projeto. |
| `CLAUDE.md` | Aponta para AGENTS.md. |
| `README.md` | Apresentação do repositório e tabela de skills disponíveis. |

Cada pasta de skill segue a estrutura `SKILL.md` (+ arquivos auxiliares opcionais), já descrita em architecture.md.
