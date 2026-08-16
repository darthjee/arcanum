# Folder Structure

## Project Root

| Directory / File | Description |
|-----------------|-------------|
| `auto-new-issue/` | Skill `/auto-new-issue` — cria um novo arquivo de issue de forma autônoma (sem interação com o usuário), comitando e sincronizando com o GitHub automaticamente. |
| `auto-plan-issue/` | Skill `/auto-plan-issue` — escreve o plano de implementação de uma issue de forma autônoma, dividindo entre agentes especialistas quando existirem. |
| `auto-fix-issue/` | Skill `/auto-fix-issue` — implementa uma issue planejada de forma autônoma, despachando agentes especialistas em paralelo e abrindo/marcando pronto o PR. |
| `auto-fix-all/` | Skill `/auto-fix-all` — orquestra o pipeline completo (issue → plano → fix → monitoramento) para uma fila de IDs, um por vez, reagindo a comentários, aprovações, falhas de CI e fechamentos de PR até esvaziar a fila. |
| `init-claude/` | Skill `/init-claude` — configura AGENTS.md/CLAUDE.md/copilot-instructions.md e a estrutura de docs do projeto. |
| `arcanum-split-issue/` | Skill `/arcanum-split-issue` — quebra uma issue ampla em várias sub-issues através de diálogo interativo, gera um arquivo local por sub-issue, e então publica cada uma como uma issue real no GitHub, ligada à issue-pai via relação nativa de sub-issue do GitHub. |
| `new-issue/` | Skill `/new-issue` — cria um novo arquivo de issue. |
| `enhance-issue/` | Skill `/enhance-issue` — ajuda o usuário a amadurecer uma ideia de issue ainda vaga (tag `Idea`/`Writting`) através de diálogo guiado por uma lista de preocupações, antes de publicá-la como `Created`. |
| `plan-issue/` | Skill `/plan-issue` — cria o plano de implementação de uma issue existente. |
| `push-issue-to-queue/` | Skill `/push-issue-to-queue` — adiciona um ou mais ids de issue ao final da fila do `auto-fix-all`. |
| `auto-rewrite-issue/` | Skill `/auto-rewrite-issue` — esvazia a fila de rewrite do `monitor-issues`, reescrevendo o corpo de cada issue marcada com `created` de forma autônoma e removendo a tag ao final. |
| `arcanum-migrate/` | Skill `/arcanum-migrate` — atualiza um repositório que já tem arcanum instalado com as mudanças estruturais (arquivos renomeados/movidos, novos formatos de config) introduzidas por versões mais novas de arcanum, via `arcanum/migrations/` (ver `docs/agents/architecture/per-repo-migrations.md`). Diferente de `/arcanum-update`, que atualiza a própria instalação do arcanum, não artefatos dentro do repositório consumidor. |
| `arcanum/` | Conteúdo empacotado no zip de release e instalado pelo fluxo `curl \| bash` (ver `docs/agents/architecture/install-and-release.md`), além de ser usado igualmente por quem faz `git clone`. Contém `arcanum/_lib/` (biblioteca compartilhada de scripts, antigo `_lib/` na raiz), `arcanum/install/` (`bootstrap.sh` e `installer.sh`, os scripts do fluxo de instalação), `arcanum/update/` (`bootstrap.sh` e `updater.sh`, os scripts do fluxo de atualização de uma instalação existente) e `arcanum/migrations/` (runner + `repos/<version>/NNN.sh` — migrações por-repositório aplicadas via `/arcanum-migrate`). |
| `arcanum.version` | Fica na raiz do repositório, usado apenas em tempo de build/release: `scripts/build_release_zip.sh` lê a versão daqui e `scripts/bump-version.sh` a atualiza. Não é mais copiado para dentro do zip de release nem lido por instalações — substituído nesse papel por `arcanum.json`, gravado dinamicamente por `installer.sh`/`updater.sh` na raiz da árvore instalada (clone ou zip), contendo `version`, `repo` (para instalações de fork continuarem atualizando a partir da própria fork) e `manifest` (lista de caminhos rastreados, usada para calcular remoções em `update`). |
| `scripts/` | Ferramentas de desenvolvimento do próprio repositório, não incluídas no zip de release: `build_release_zip.sh` (monta o zip de release, incluindo o arquivo `MANIFEST` embutido na raiz do zip) e `bump-version.sh` (atualiza `arcanum.version` e a versão padrão embutida em `arcanum/install/bootstrap.sh`). |
| `.circleci/` | Pipeline de release: em push de tag semver, builda o zip de release via `scripts/build_release_zip.sh` e publica como asset de uma GitHub Release. |
| `docs/agents/` | Documentação do próprio repositório (arquitetura, fluxo, issues, plans). |
| `docs/guides/` | Único subdiretório de `docs/` incluído no zip de release (ver `scripts/build_release_zip.sh`) — guias voltados ao usuário final de um repositório que instalou arcanum, ex: `arcanum-repo-config.md` e `arcanum-repo-version.md`, referenciados pelos avisos de fallback/erro dos próprios scripts. |
| `.github/` | Contém `copilot-instructions.md`, que aponta para AGENTS.md. |
| `.claude/` | Configuração local do Claude Code para este repositório. Contém subpastas para estado de runtime e configuração de skills. |
| `.claude/state/` | Runtime state files: queue JSON (`auto-fix-all-queue.json`), queue lock (`auto-fix-all-queue.lock`), per-PR comment tracking (`auto-monitor-pr-<pr_number>-comments.json`), rewrite queue JSON/lock (`monitor-issues-rewrite-queue.json`/`.lock`). In a repo initialized by `init-claude`, also holds `init-claude-config.json` (the label/color table synced by `setup_labels.md`). |
| `.claude/configuration/` | Skill configuration files: e.g. `arcanum-repo-config.json` (namespaced, arcanum-wide config — controls `auto-fix-all`'s ignored CI check patterns under its own key, plus the repo's tracked arcanum `.version`; `auto-fix-all.json` is the legacy, pre-namespacing fallback — see `docs/guides/arcanum-repo-config.md`). |
| `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | Config global, cross-project — **fora** do repositório, diferente de todas as linhas acima; escopado por conta/perfil ativo do Claude Code. É a camada mais externa da cadeia de resolução de config do arcanum (estado local do repo -> config do repo -> config global do usuário -> valor padrão fixo), consultada apenas quando nenhum dos dois arquivos escopados ao repo tem valor — ver `docs/agents/architecture/shared-state-and-configuration.md` e `docs/guides/arcanum-global-config.md`. |
| `AGENTS.md` | Instruções compartilhadas do projeto. |
| `CLAUDE.md` | Aponta para AGENTS.md. |
| `README.md` | Apresentação do repositório e tabela de skills disponíveis. |

Cada pasta de skill segue a estrutura `SKILL.md` (+ arquivos auxiliares opcionais), já descrita em `docs/agents/architecture/overview-and-layout.md`.
