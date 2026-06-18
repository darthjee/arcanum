# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `check-plan/` | Skill `/check-plan` — valida um plano de implementação existente. |
| `fix-issue/` | Skill `/fix-issue` — abre um PR para corrigir uma issue. |
| `init-claude/` | Skill `/init-claude` — configura AGENTS.md/CLAUDE.md/copilot-instructions.md e a estrutura de docs do projeto. |
| `new-issue/` | Skill `/new-issue` — cria um novo arquivo de issue. |
| `new-plan/` | Skill `/new-plan` — cria uma issue e seu plano em um fluxo único. |
| `plan-issue/` | Skill `/plan-issue` — cria o plano de implementação de uma issue existente. |
| `docs/agents/` | Documentação do próprio repositório (arquitetura, fluxo, issues, plans). |
| `.github/` | Contém `copilot-instructions.md`, que aponta para AGENTS.md. |
| `.claude/` | Configuração local do Claude Code para este repositório. |
| `AGENTS.md` | Instruções compartilhadas do projeto. |
| `CLAUDE.md` | Aponta para AGENTS.md. |
| `README.md` | Apresentação do repositório e tabela de skills disponíveis. |

Cada pasta de skill segue a estrutura `SKILL.md` (+ arquivos auxiliares opcionais), já descrita em architecture.md.
