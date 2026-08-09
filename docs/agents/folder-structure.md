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
| `enhance-issue/` | Skill `/enhance-issue` — ajuda o usuário a amadurecer uma ideia de issue ainda vaga (tag `Idea`/`Writting`) através de diálogo guiado por uma lista de preocupações, antes de publicá-la como `Created`. |
| `plan-issue/` | Skill `/plan-issue` — cria o plano de implementação de uma issue existente. |
| `push-issue-to-queue/` | Skill `/push-issue-to-queue` — adiciona um ou mais ids de issue ao final da fila do `auto-fix-all`. |
| `auto-rewrite-issue/` | Skill `/auto-rewrite-issue` — esvazia a fila de rewrite do `monitor-issues`, reescrevendo o corpo de cada issue marcada com `created` de forma autônoma e removendo a tag ao final. |
| `arcanum/` | Conteúdo empacotado no zip de release e instalado pelo fluxo `curl \| bash` (ver `docs/agents/architecture.md`), além de ser usado igualmente por quem faz `git clone`. Contém `arcanum/_lib/` (biblioteca compartilhada de scripts, antigo `_lib/` na raiz) e `arcanum/install/` (`bootstrap.sh` e `installer.sh`, os scripts do fluxo de instalação). |
| `arcanum.version` | Marca a versão instalada na raiz da árvore (clone ou zip de release). Usado pelo instalador para recusar sobrescrever uma instalação já existente. |
| `scripts/` | Ferramentas de desenvolvimento do próprio repositório, não incluídas no zip de release: `build_release_zip.sh` (monta o zip de release) e `bump-version.sh` (atualiza `arcanum.version` e a versão padrão embutida em `arcanum/install/bootstrap.sh`). |
| `.circleci/` | Pipeline de release: em push de tag semver, builda o zip de release via `scripts/build_release_zip.sh` e publica como asset de uma GitHub Release. |
| `docs/agents/` | Documentação do próprio repositório (arquitetura, fluxo, issues, plans). |
| `.github/` | Contém `copilot-instructions.md`, que aponta para AGENTS.md. |
| `.claude/` | Configuração local do Claude Code para este repositório. Contém subpastas para estado de runtime e configuração de skills. |
| `.claude/state/` | Runtime state files: queue JSON (`auto-fix-all-queue.json`), queue lock (`auto-fix-all-queue.lock`), per-PR comment tracking (`auto-monitor-pr-<pr_number>-comments.json`), rewrite queue JSON/lock (`monitor-issues-rewrite-queue.json`/`.lock`). In a repo initialized by `init-claude`, also holds `init-claude-config.json` (the label/color table synced by `setup_labels.md`). |
| `.claude/configuration/` | Skill configuration files: e.g. `auto-fix-all.json` (controls ignored CI check patterns). |
| `AGENTS.md` | Instruções compartilhadas do projeto. |
| `CLAUDE.md` | Aponta para AGENTS.md. |
| `README.md` | Apresentação do repositório e tabela de skills disponíveis. |

Cada pasta de skill segue a estrutura `SKILL.md` (+ arquivos auxiliares opcionais), já descrita em architecture.md.
