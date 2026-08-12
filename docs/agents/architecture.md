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

Toda lógica compartilhada entre skills vive em `arcanum/_lib/` (antigo `_lib/` na raiz — movido para dentro de `arcanum/` para que o zip de release, descrito abaixo, seja autocontido). Scripts de skills referenciam essa pasta como `../../arcanum/_lib/...`, relativo à própria pasta `<skill>/scripts/`.

## Install & Release Pipeline

Além do `git clone`, arcanum pode ser instalado via um one-liner `curl | bash`, em duas etapas:

1. **Bootstrap** (`arcanum/install/bootstrap.sh`) — buscado diretamente via `curl` a partir da branch `main`. Resolve `ARCANUM_REPO` (default `darthjee/arcanum`) e `ARCANUM_VERSION` (default: versão embutida no próprio script, atualizada por `scripts/bump-version.sh`), baixa o zip de release correspondente, descompacta em um diretório temporário e passa o controle para o instalador contido nele. Exporta `REPO`/`VERSION` para o processo que o substitui via `exec`, já que o instalador precisa dos dois para gravar `arcanum.json`. Mantido propositalmente pequeno e auditável, já que é o único trecho executado às cegas.
2. **Installer** (`arcanum/install/installer.sh`) — vem dentro do zip de release (e também em um `git clone` normal), versionado junto com o release que instala. Verifica se já existe um `arcanum.json` no diretório alvo (nesse caso, recusa e recomenda rodar `update` em vez de reinstalar), pergunta interativamente o diretório de destino (lendo de `/dev/tty`, já que o stdin sob `curl | bash` é o conteúdo do próprio script), copia as pastas de skills + `arcanum/` para o destino confirmado e grava `arcanum.json` (version/repo/manifest) com base nas variáveis `REPO`/`VERSION` recebidas e no arquivo `MANIFEST` embutido no zip.

O zip de release é montado por `scripts/build_release_zip.sh` (ferramenta de desenvolvimento, não incluída no próprio zip) e publicado pelo pipeline do CircleCI (`.circleci/config.yml`) como asset de uma GitHub Release, disparado em push de tag semver (mesmo padrão `X.Y.Z` já usado pelas tags existentes do repositório). O zip inclui um arquivo `MANIFEST` (lista de todo caminho empacotado, um por linha, gerada a partir do mesmo array `FILES` usado para montar o zip) na raiz da árvore, usado tanto pelo instalador quanto pelo atualizador para reconciliar instalações sem depender de `git`.

### Update

Complementando `install`, `arcanum/update/{bootstrap.sh,updater.sh}` traz uma instalação já existente para uma release mais nova, reconciliando o diretório alvo: adiciona arquivos novos, sobrescreve os alterados e remove os que saíram da release — sem tocar em nada mais no diretório. Mesma arquitetura de duas etapas do `install`:

1. **Bootstrap** (`arcanum/update/bootstrap.sh`) — pode ser invocado tanto via `curl | bash` (sempre busca a lógica mais nova) quanto diretamente a partir de uma instalação já existente (`bash <install-dir>/arcanum/update/bootstrap.sh`). Diferente do `install/bootstrap.sh`, não tem uma versão padrão embutida: quando `ARCANUM_VERSION` não é definido, consulta `GET https://api.github.com/repos/${ARCANUM_REPO}/releases/latest` (parseado com `grep`/`sed`, sem `jq`, para manter essa etapa livre de dependências) para resolver a última release publicada. Também resolve `TARGET`, o `REPO` padrão e o **método de instalação** antes de baixar qualquer coisa: se `${BASH_SOURCE[0]}` aponta para um arquivo real já dentro de uma instalação (dois diretórios acima existe `arcanum.json` ou `.git`), usa esse diretório como `TARGET`; `arcanum.json` presente → instalação via zip (fluxo abaixo, inalterado), lê `repo` de `arcanum.json` como default de `ARCANUM_REPO`; `arcanum.json` ausente mas `.git` presente → instalação via `git clone`, lê o owner/repo a partir de `git remote get-url origin` como default de `ARCANUM_REPO` em vez de `arcanum.json` (mesmo papel, fonte diferente). Sem nenhum dos dois, cai para `ARCANUM_TARGET` se definido, ou deixa `TARGET` vazio para o `updater.sh` perguntar interativamente (fluxo zip). Antes de tocar a rede ou o alvo, imprime o repo/versão/método resolvidos e exige confirmação explícita y/N lida de `/dev/tty` (mesmo padrão do prompt de diretório-alvo do `installer.sh`/`updater.sh`) — pulada quando `ARCANUM_ASSUME_YES` está definido (qualquer valor não-vazio), pensado como prefixo pontual do comando, não para ser exportado permanentemente. Captura `ORIG_PWD="$(pwd)"` no início e exporta junto com `REPO`/`VERSION`/`TARGET` antes do `exec` para `updater.sh`, já que o `exec` substitui o processo e o próprio `bootstrap.sh` não pode restaurar o cwd do chamador depois disso.
2. **Updater** (`arcanum/update/updater.sh`) — vem dentro do zip de release; só é alcançado pelo fluxo zip (o fluxo git, abaixo, nunca invoca `updater.sh`). Lê `arcanum.json` existente no alvo (versão/repo/manifest antigos); se a versão já bate com a nova, encerra com uma mensagem "already on X.Y.Z" sem tocar em nada. Caso contrário, adquire um lock de concorrência via `mkdir "${TARGET}/.arcanum-update.lock"` (atômico — ou o `mkdir` funciona ou já existe) antes de tocar o alvo; se já existe, falha rápido orientando a remover o diretório manualmente caso seja lixo de uma execução anterior que travou. Só então: copia a árvore nova por cima do alvo (`cp -R`, igual ao instalador), calcula o conjunto de remoção como a diferença entre o `manifest` antigo (de `arcanum.json`) e o `MANIFEST` novo (embutido no zip) — cada caminho candidato à remoção é validado antes de qualquer `rm` (rejeita caminho absoluto ou com segmento `..`; resolve o caminho físico via `cd`/`pwd` do diretório contendo o arquivo e confirma que o resultado continua estritamente dentro do alvo) — e só então grava o novo `arcanum.json`, por último, o que torna uma falha no meio do processo seguramente reexecutável. O `trap ... EXIT` restaura o cwd do chamador (`cd "$ORIG_PWD"`, no-op seguro se `ORIG_PWD` não estiver definido — ex.: `updater.sh` chamado diretamente), libera o lock (`rmdir`) e por fim limpa seu próprio diretório de trabalho (diferente do `install/bootstrap.sh`, que nunca limpa o seu, aceitável para uma operação de execução única; `update` tende a rodar repetidamente).

Instalações via `git clone` (sem `arcanum.json`) têm seu próprio fluxo dentro do `bootstrap.sh`, sem passar pelo `updater.sh`: antes de qualquer `fetch`, compara a `VERSION` resolvida com a tag atual do alvo (`git describe --tags --exact-match`) e sai cedo se já estiver em dia; verifica `git status --porcelain` e recusa seguir (sem auto-stash/auto-discard) se houver mudanças não commitadas; confirma (mesmo mecanismo de prompt acima, com texto específico citando o método git); e então roda `git fetch --tags --prune && git checkout <VERSION>` diretamente no alvo, deixando-o em detached HEAD na tag resolvida. Não precisa do lock de concorrência do fluxo zip — os próprios lock files internos do `git checkout` já fazem uma segunda execução concorrente falhar de forma limpa.

`installer.sh` redireciona para `update` em vez de recusar sem alternativa quando já existe uma instalação — ver acima.

A skill `/arcanum-update` (`arcanum-update/SKILL.md` + `arcanum-update/scripts/run_update.sh`) expõe esse fluxo de dentro de uma sessão do Claude Code, sem precisar de shell: `run_update.sh check` resolve método/repo/versão atual (mesma lógica de detecção acima, ancorada na própria localização em disco da skill); a skill pede confirmação em conversa antes de rodar `run_update.sh apply`, que define `ARCANUM_ASSUME_YES=1` e executa `bootstrap.sh` diretamente, retransmitindo sua saída ao vivo.

## Lógica determinística

Sempre que uma skill precisar de lógica determinística (parsing, validação, manipulação de arquivos), prefira extrair essa lógica para um script (ex: shell, dentro da própria pasta da skill) em vez de descrevê-la em linguagem natural. Isso evita ambiguidade de interpretação e reduz o consumo de tokens em cada execução.

## Script Preference

Deterministic logic — parsing, file mutation, API calls, validation, any step that must produce the same output for the same input — must live in shell scripts inside `<skill>/scripts/`, not in markdown instructions relying on AI judgment.

Scripts are invoked from markdown steps with explicit arguments. This means:
- No ambient reasoning required to execute a step correctly.
- Edge cases are handled once, in the script, not re-interpreted on every run.
- Token usage per run is reduced — the AI reads a one-liner invocation, not a paragraph of prose.

**Guideline:** when adding a new skill or extending an existing one, ask: "could this step produce a wrong result due to AI misinterpretation?" If yes, extract it to a script.

## Agent Roster

Specialist agents are defined in `.claude/agents/`. The architect coordinates them; each specialist owns a clearly bounded scope.

| Agent | Scope | When the architect dispatches it |
|-------|-------|----------------------------------|
| `scripter` | `<skill-name>/scripts/` — writes and edits bash scripts | Whenever a skill needs deterministic logic extracted into a new or updated script |
| `skill-reviewer` | Reads skill files (SKILL.md + step `.md` files) changed in a PR and reports complex inline bash that violates the script-extraction rule | During PR review, after implementation, to validate that no complex logic was left inline |

`skill-reviewer` is a **read-only** agent: it never commits, never fixes violations — it only reports findings. The architect decides what to do (usually: dispatch `scripter` to extract the flagged logic).

## Architect Delegation

A skill that's meant to run autonomously, with no user interaction (the `auto-*` family is the current example), should not just narrate "you are acting as the architect" and execute its own steps inline in whichever context invoked it — that context might be the general/coordinator context (a human typing the slash command directly, or a `/loop` re-entry), which then carries that reasoning forward across unrelated turns. Instead, split the skill into two layers:

- **`SKILL.md` (coordinator layer)** — thin. Parses arguments, resolves `REPO_PATH="$(pwd)"` (the one moment the target project's root can be trusted from ambient cwd — see "Repo Path Threading" below), then spawns a real subagent:

  > Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `<skill-name>` skill folder) and follow it. ARGUMENTS: <raw skill arguments> REPO_PATH: <resolved_path>")

  Waits for it, then relays its final report verbatim. Keep in the coordinator only what the `architect` agent's tool set (`Read, Edit, Write, Bash, Agent` — no `ScheduleWakeup`, no `AskUserQuestion`) genuinely cannot do itself — e.g. `auto-fix-all`'s `ScheduleWakeup`-based context clearing between issues, and its one user-facing question when a PR is closed without merging.
- **`steps/run.md` (architect layer)** — the actual step-by-step instructions (what used to be the `SKILL.md` body). This is what the spawned `architect` agent reads and follows. It parses `REPO_PATH` out of its own invocation prompt and threads it through every script call it makes.

When one of these skills is invoked **from inside another** (e.g. `auto-fix-all` running `auto-new-issue`'s logic as part of processing one issue), the caller is already running as an `architect` agent — it reads the callee's `steps/run.md` directly and follows it, without spawning a second nested `Agent(architect)`. Only the outermost, human/coordinator-facing invocation spawns the subagent. `REPO_PATH` is carried forward unchanged into that direct read too — never re-resolved from `pwd` partway through a run, since a nested step's ambient cwd can no longer be trusted (see "Repo Path Threading" below).

## Repo Path Threading

Every script that needs to resolve the target GitHub repo (via `arcanum/_lib/origin.sh`'s `get_repo_ref`/`get_domain`/`get_repo_path`, or `arcanum/_lib/github_issue.sh`'s commands, which source it) takes `repo_path` as a **required, leading** positional CLI argument — never falling back to `git remote get-url origin` against whatever the ambient shell cwd happens to be at call time. This is deliberate: a `cd` anywhere downstream in a skill's flow (including inside a spawned subagent) must never silently change which GitHub repo a script talks to.

The convention: `REPO_PATH` is resolved exactly **once**, at the very top of a skill's run, the one moment ambient cwd can be trusted —
- for a skill that runs entirely inline as the architect (no subagent spawn — e.g. `discuss-issue`, `enhance-issue`, `monitor-issues`, `init-claude`, `push-issue-to-queue`), that's the first step of its own `SKILL.md`;
- for a skill using the coordinator/architect-subagent split described above, that's the coordinator-layer `SKILL.md`, right before it spawns.

From that point on, `REPO_PATH` is threaded explicitly — as the leading argument to every script call, and as part of the prompt text for every further `Agent(architect, ...)` spawn or direct nested `steps/*.md` read (see "Cross-Skill References" below) — for the rest of that run. It is never re-derived from `pwd` partway through, since downstream steps (or a spawned subagent) may have `cd`'d elsewhere by then.

## Shared State & Configuration Files

Skills store runtime state and configuration under `.claude/`:

| File | Purpose | Schema |
|------|---------|--------|
| `.claude/state/auto-fix-all-queue.json` | Queue of issue IDs to be processed by `auto-fix-all`. The first element is always the currently in-progress entry. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/auto-fix-all-queue.lock` | Lock file used during `push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/issue-<id>.json` | Unified per-issue state file used by `auto-fix-issue`, `monitor-issues`, and `auto-monitor-pr`. `auto-fix-issue` writes the `step` field after each completed step so the skill can resume on re-invocation. `monitor-issues` stores per-issue `updated_at` and `tags` here (replacing its own `issues.json` entry). `auto-monitor-pr` stores `pr_comments` and `last_comment_time` here when called with an issue id (replacing the legacy per-PR file). | `{"step": "<step_name>", "updated_at": "<ISO8601>", "tags": ["<tag>", ...], "pr_comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "state": "fetched\|processing\|addressed", "emojis": ["<:emoji_name:>"]}], "last_comment_time": "<ISO8601>"}` — all fields optional |
| `.claude/state/auto-monitor-pr-<pr_number>-comments.json` | **Deprecated.** Legacy per-PR comments file used by `auto-monitor-pr` when no issue id is supplied. New invocations should pass an issue id and use `.claude/state/issue-<id>.json` instead. | `{"comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open"\|"addressed"}], "last_comment_time": "<ISO8601>"}` |
| `.claude/configuration/arcanum-repo-config.json` | Committed, shared, arcanum-wide configuration — each feature keeps its own namespaced key so features never collide. Holds `auto-fix-all`'s CI-ignore config (which check names are ignored when deciding pass/fail) plus, at the top level (not namespaced), `.version` — this repo's recorded arcanum version, stamped by `init-claude` and read by `arcanum/migrations/run.sh` (see "Per-Repo Migrations" below). Superseded `.claude/configuration/auto-fix-all.json`, which remains a **fallback**: if a key is absent from this file, readers fall through to the legacy file and print a warning pointing at `docs/guides/arcanum-repo-config.md`. `arcanum/_lib/repo_config.sh` implements this fallback (`repo_config_read`) plus the lock-protected write/seed helpers (`repo_config_write`, `repo_config_seed`) once, for every reader/writer to share — `auto-fix-all/scripts/config.sh` and `auto-fix-all/scripts/wait_ci.sh` both route through it instead of hardcoding the legacy path independently. | `{"version": "<semver>", "auto-fix-all": {"ignored_check_patterns": ["<substring>", ...]}}` |
| `.claude/state/arcanum-config.json` | Per-checkout, gitignored, arcanum-wide run-time state — same namespacing/fallback story as `arcanum-repo-config.json` above, but for personal/frequently-toggled state instead of committed settings. Holds `auto-fix-all`'s `clear_context` toggle (flipped by `/toggle-clear-context`) and `finish_on_empty_queue` toggle (opts a run into stopping cleanly once its queue drains instead of blocking forever on `queue.sh wait-next`) under the `auto-fix-all` key — both writable via `init-claude`'s `setup_auto_fix_all_config.md` step, `finish_on_empty_queue` has no standalone toggle skill. Superseded `.claude/state/auto-fix-all-config.json`, which remains a fallback with the same warning behavior as the configuration file above. `auto-fix-all/scripts/config.sh` routes both keys' reads/writes here (via `arcanum/_lib/repo_config.sh`); every other key still goes to the configuration file pair above. | `{"auto-fix-all": {"clear_context": true\|false, "finish_on_empty_queue": true\|false}}` |
| `.claude/state/monitor-issues-config.json` | Per-checkout, gitignored run-time state for `monitor-issues`. Holds the `clear_context` toggle flipped by `/toggle-monitor-clear-context`, kept out of the (would-be) committed `.claude/configuration/monitor-issues.json` configuration file. `monitor-issues/scripts/config.sh` routes `clear_context` reads/writes here; every other key still goes to the committed configuration file. | `{"clear_context": true\|false}` |
| `.claude/state/monitor-issues-rewrite-queue.json` | Queue of issue IDs awaiting a `created` rewrite, drained by `auto-rewrite-issue`. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/monitor-issues-rewrite-queue.lock` | Lock file used during `rewrite_queue.sh push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/init-claude-config.json` | Created by `init-claude`'s `setup_labels.md` step, in the **target repo being initialized** (not Arcanum's own state, unlike the other rows in this table). Stores the label/color table `init-claude/scripts/sync_labels.sh` renders and syncs to GitHub, so the script needs no config-path CLI argument to know the current table (it does require `repo_path` as its leading argument, per "Repo Path Threading" above). Auto-populated with the standard 10 labels (including `Fetched`, backing the `fetched` issue tag) by `init-claude/scripts/lib/label_config.sh`'s `label_config_ensure_defaults` function whenever the file is missing or its `labels` array is empty; `init-claude/scripts/write_label_config.sh <replace\|remove\|add> <config_path> ...` mutates it during a user-driven refinement loop — `replace` overwrites the whole `labels` array, `remove` deletes named labels, `add` upserts `<name>:<color>` pairs. | `{"labels": [{"name": "<label name>", "color": "<hex color, no leading '#'>"}, ...]}` |

Never write to these files directly — always use the dedicated scripts (e.g. `queue.sh push`, `queue.sh pop`) that handle locking and atomicity.

## Branch Bootstrap and Merge Conflicts

`arcanum/_lib/git_branch.sh` exposes two shared functions used whenever a skill needs to bring an issue branch up to date with `main`: `git_branch_fetch_main` (fetches `origin main`, tolerating a missing remote ref) and `git_branch_merge_main` (fetches, then merges `origin/main` into whatever branch is currently checked out via `git merge --no-edit`, without aborting on conflict — it leaves the conflict markers in place and reports the conflicted paths).

- `auto-fix-all/scripts/checkout_from_main.sh <id>` uses it to bootstrap the `issue-<id>` branch at the start of `process_one_issue.md`: it reuses the branch (local or remote) merged up to date with `origin/main` when it already exists — e.g. because `discuss-issue` committed an issue file and/or plan to it earlier — and only creates it fresh from `origin/main` when it doesn't exist at all. It never unconditionally discards an existing branch.
- `auto-fix-issue/scripts/merge_main.sh` uses it in `auto-fix-issue/steps/run.md`'s Step 2, right after the branch is checked out and before any specialist agent is dispatched, so implementation always starts from a branch merged up to date with `main`.

Both scripts print `STATUS=ok` or `STATUS=conflict` (plus the conflicted-file list on conflict) and exit `0`/`2` accordingly. On `STATUS=conflict`, the calling `.md` step applies the same responsible-agent-selection approach `handle_comment.md`'s "Choosing the responsible agent(s)" section already uses for PR comments and CI failures — treating each conflicted path like a failed check-run name — to resolve the conflict and commit, with no user interaction.

`auto-fix-all/SKILL.md`'s "closed PR" reimplement path is the one case that still wants a truly clean branch: since the user explicitly asked to start over, it runs `scripts/github.sh cleanup-branch <repo_path> <id>` to delete the rejected branch *before* looping back to `process_one_issue.md`, so the reuse-based bootstrap above finds nothing to reuse and creates a fresh branch.

## Cross-Skill References

Skills may reference another skill's `steps/*.md` or `scripts/*.sh` directly via a relative path, rather than duplicating logic — e.g. `auto-fix-all/steps/handle_comment.md` calls `auto-plan-issue/scripts/list_agents.sh`, and `auto-fix-all/steps/process_one_issue.md` reads `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue`'s `steps/run.md` directly (as the architect, without spawning a nested `Agent(architect)` — see "Architect Delegation" above). `discuss-issue/steps/discuss_and_save.md` follows the same pattern: once the user confirms they want planning to start right after discussion, it calls `auto-fix-all/scripts/checkout_from_main.sh` (to bootstrap the branch) and `auto-new-issue/scripts/commit_issue.sh` (to commit+push the issue file), then reads `auto-plan-issue/steps/run.md` directly, before pushing again — carrying discussion context straight into a committed plan without a separate `/auto-plan-issue` invocation losing it. Whenever such a direct read/call crosses into a script that resolves the GitHub repo, `REPO_PATH` (see "Repo Path Threading" above) goes along with it, unchanged from wherever it was first resolved — a cross-skill reference never re-resolves it.

## Issue Tags

Issue status is tracked via real GitHub labels on the issue — labels are the sole source of truth; there is no body-embedded tags block. Reading a tag means checking whether a specific label is present on the issue's `labels`; writing a tag means adding or removing that label via `gh issue edit --add-label`/`--remove-label`. `arcanum/_lib/tags.sh` defines the canonical-tag/label-name mapping (both directions) and exposes `extract_tags`/`has_tag`, which operate on a newline-separated list of label names (e.g. the output of `gh issue view ... --json labels -q '.labels[].name'`) rather than free body text — unrecognized labels are silently ignored.

| Canonical tag | GitHub label |
| --- | --- |
| `created` | `Created` |
| `ready_for_work` | `Ready for Work` |
| `shipit` | `shipit` |
| `working` | `Working` |
| `question` | `Question` |
| `fetched` | `Fetched` |
| `refined` | `Refined` |
| `ready` | `Ready` |
| `enqueued` | `Enqueued` |
| `idea` | `Idea` |
| `writting` | `Writting` |
| `enhancing` | `Enhancing` |
| `pr` | `PR` |

**`shipit`** is human-only: no script ever adds or removes the `shipit` label (`arcanum/_lib/tag_mutate.sh` refuses any attempt at the shared-library level). It marks an issue as pre-approved, so `auto-fix-all` skips PR review/monitoring and merges directly once CI passes, checked via `auto-fix-all/scripts/github.sh has-shipit-label` — the pipeline's only interaction with this tag is reading it.

**`question`** marks an issue as having a question for the agent. `monitor-issues` detects it (via `arcanum/_lib/tag_actions.sh`'s `actionable_tags`) and logs that it needs an answer — actually answering it requires AI judgment, so that step is left to architect-level reasoning, not the polling script. Once answered, the label should be removed from the live GitHub issue via `monitor-issues/scripts/github.sh remove-tag <repo_path> <id> question`.

**`created`** marks an issue as ready to be read and rewritten by the agent. Unlike `question`, this action is now fully wired end-to-end: `monitor_issues.sh` pushes the issue id onto `monitor-issues/scripts/rewrite_queue.sh`'s queue (`.claude/state/monitor-issues-rewrite-queue.json`) as soon as the label is detected. The `auto-rewrite-issue` skill drains that queue: for each id it fetches the issue body, rewrites it (architect-level AI judgment, the same kind of rewrite `discuss-issue/steps/discuss_and_save.md` performs but fully autonomous), pushes the new body to GitHub, then removes the label via `monitor-issues/scripts/github.sh remove-tag <repo_path> <id> created`. The label is also applied earlier in the pipeline, through an interactive human dialogue rather than a poll: `arcanum/_lib/github_issue.sh`'s `mark-created` subcommand, called by `enhance-issue`'s "Publish back to GitHub" step once a still-vague `Idea`/`Writting` issue has been fleshed out through the checklist-driven dialogue, adds `Created` and removes `Idea`/`Writting`/`Enhancing`, if present — deliberately never touching `refined`/`ready`, unlike `mark-refined`.

**`ready_for_work`** marks an issue as ready to be pushed to the `auto-fix-all` queue, backed by the `Ready for Work` label (distinct from the plain `Ready` label, which developers may still use informally to mean "well-defined" without triggering auto-enqueuing). Unlike the two tags above, this action is fully deterministic, so `monitor_issues.sh` performs it directly: it pushes the issue id via `auto-fix-all/scripts/queue.sh push <repo_path> <id>` as soon as the label is detected.

**`fetched`** and **`working`** are pipeline-status tags, not actionable ones — `monitor-issues` does not detect or act on them (they are not part of `arcanum/_lib/tag_actions.sh`'s `ACTIONABLE_TAGS`). They exist purely so the GitHub issue list reflects `auto-fix-all`'s progress at a glance: `auto-fix-all` pushes `fetched` onto the live issue right after fetching/checking it (`auto-fix-all/steps/process_one_issue.md` step 2), then swaps it for `working` once the implementation plan has been written and coding is about to start (step 3). This applies only to the `auto-fix-all` pipeline — the manual `/new-issue`, `/plan-issue`, and `/discuss-issue` skills never push either label.

**`refined`** marks an issue as discussed/confirmed but not yet planned. It's applied by `arcanum/_lib/github_issue.sh`'s `mark-refined` subcommand, called by `discuss-issue`'s "Push to GitHub" step right after its `update` call succeeds — it adds `Refined` and removes `Created`, if present.

**`ready`** and **`enqueued`** keep the live GitHub labels in sync with the pipeline stage an issue is actually in, so the label-based issue list doesn't drift stale while an issue is being discussed or queued. `ready` is applied by `arcanum/_lib/github_issue.sh`'s `mark-ready` subcommand, called by `discuss-issue`'s step 8 right after the `git push` that publishes the `issue-<id>` branch with the committed issue + plan — this is the point where the issue + plan are actually ready for `auto-fix-all`/`auto-fix-issue` to pick up; it adds `Ready` and removes `Refined`, if present (not `Created` anymore). `arcanum/_lib/github_issue.sh`'s shared `cmd_update` (also used by `auto-new-issue` to sync freshly authored issues) is untouched, so issues created that way are not marked `Ready`. `enqueued` is applied by `auto-fix-all/scripts/queue.sh`'s `_mark_enqueued` helper, called at the end of both the `save` and `push` cases — the only two places an id ever enters the queue — so it applies uniformly whether the id arrived via `auto-fix-all`'s initial seed, `monitor-issues` detecting `Ready for Work`, or `push-issue-to-queue`; it adds `Enqueued` and removes `Ready for Work`/`Created`, if present. Both mutations are best-effort: a `gh` failure logs a warning to stderr and never blocks the underlying issue-sync or queue write.

**`idea`** and **`writting`** mark an issue as still being drafted by the user, before it reaches the `Created` stage — set manually by a human, not by any script. They're removed by `arcanum/_lib/github_issue.sh`'s `mark-created` subcommand, called by `enhance-issue`'s "Publish back to GitHub" step once the dialogue concludes — and, as a fallback for issues that skip `enhance-issue` and go straight to `discuss-issue`, also by `mark-refined` alongside `created`, the same call `discuss-issue`'s "Push to GitHub" step already makes — so they never linger on an issue past refinement either way.

**`enhancing`** marks an issue as actively being worked by `enhance-issue`'s AI-assisted dialogue, distinct from the passive `Idea`/`Writting` backlog state. It's applied by `arcanum/_lib/github_issue.sh`'s new `mark-enhancing` subcommand, called by `enhance-issue`'s fetch step as soon as an `Idea`/`Writting` issue is fetched for enhancement (removing `Idea`/`Writting`); it's removed again by the existing `mark-created` subcommand once `enhance-issue` publishes, alongside `Idea`/`Writting`. It is purely transient and scoped to `enhance-issue` only — `discuss-issue` does not use it.

**`pr`** is added by `auto-fix-issue`'s `pr-create`/`pr-ready` (`auto-fix-issue/scripts/github.sh`'s `_sync_pr_labels_and_state`, called from `cmd_pr_create`/`cmd_pr_ready`) once a PR exists for the issue, idempotently via `tag_mutate_add_label`, so the issue's label list reflects at a glance whether a PR is open. The same helper also refreshes `.claude/state/issue-<id>.json`'s `tags` field from the issue's current GitHub labels.

`auto-shipit` (PR-only — deliberately not part of the canonical issue-tag table above, since it is never read from or written to an issue) is a purely informational label with no reader anywhere in the pipeline. `_sync_pr_labels_and_state` adds it directly to the PR (`gh pr edit --add-label auto-shipit`) whenever the issue's refreshed tags include `shipit`, so a developer glancing at the PR's labels can tell at a glance that the underlying issue already had `shipit` approval — the human-only `shipit` label on the issue itself is never touched.

### Tag mutation primitives

`arcanum/_lib/tag_mutate.sh` exposes `tag_mutate_add_label <id> <repo_ref> <tag>` and `tag_mutate_remove_label <id> <repo_ref> <tag>`, which resolve the canonical tag name to a label via `arcanum/_lib/tags.sh`, fetch the issue's current labels to decide whether the mutation is a no-op, and otherwise call `gh issue edit --add-label`/`--remove-label` directly — no body fetch/splice/push round-trip. Both refuse to mutate `shipit`. `monitor-issues/scripts/github.sh remove-tag` and `auto-fix-all/scripts/github.sh add-tag`/`remove-tag` are thin CLI wrappers around this shared library — new skills needing to mutate issue tags should add their own thin wrapper rather than re-implementing the label lookup/fetch logic.

## Lock System

The lock system prevents concurrent mutations of shared JSON state files. Currently used by `auto-fix-all/scripts/queue.sh` for `push` and `pop` operations on the queue.

**Lock file:** `.claude/state/auto-fix-all-queue.lock`

**Mechanism:**
1. Write a unique instance ID (hostname + PID + timestamp) into the lock file.
2. Sleep 1 second.
3. Re-read the lock file — if it still contains this instance's ID, the lock is held; otherwise another writer won the race, so retry from step 1.
4. Perform the mutation.
5. Delete the lock file to release.

**Properties:**
- Never gives up — retries indefinitely.
- After 10 consecutive failed attempts, prints a warning once suggesting manual inspection and removal of a potentially stale lock file.
- If a process crashes while holding the lock, the lock file can be removed by hand to unblock other writers.

**Rule for implementers:** any script that mutates a shared JSON file must go through the lock/mutate/release sequence above. Never write the queue JSON (or other shared state) directly without holding the lock.

## Per-Repo Migrations

Complementing `/arcanum-update` (which updates the arcanum *install* itself), `arcanum/migrations/` lets a repo that already has arcanum installed catch up on repo-side structural changes (a renamed/moved config file, a new folder, a new config shape) introduced by a later arcanum version — something `/arcanum-update` never touches, since it only reconciles the install tree, not artifacts inside the consuming repo.

**Layout:** `arcanum/migrations/repos/<version>/NNN.sh` — one folder per arcanum version that shipped migrations, each containing zero-padded, numbered scripts run in order. `arcanum/migrations/repos/next/` holds migrations not yet released; `scripts/bump-version.sh` rolls it into `arcanum/migrations/repos/<new-version>/` and recreates an empty `next/` (with a `.keep` placeholder) on every version bump, so a migration always ships in the same release as the change it belongs to. `arcanum/migrations/generate_next.sh` computes the next `NNN.sh` number for a new migration (never fills a gap left by a removed one).

**The `NNN.sh` contract** (checked by `arcanum/migrations/update_per_file.sh` before/while running one):
- `NNN.sh config` → prints `{"skippable": true|false}`.
- `NNN.sh run` → performs the migration; must be idempotent (safe to re-run), since a non-skippable failure leaves the recorded version frozen so the same migration is retried on the next run.

**The runner chain** — `arcanum/migrations/run.sh` (top-level entry point) → `select_version.sh` (when the user picks specific versions) → `update_per_version.sh` (one version folder) → `update_per_file.sh` (one script) — mirrors the confirmation-gate pattern used elsewhere in arcanum (explicit `[A]ll`/`[N]one`/`[S]elect`, never a silent unattended sweep by default). `run.sh` supports both a fully interactive form (direct terminal use, `/dev/tty` prompts all the way down) and a `check`/`apply --all|--none|--select <version>` form, so the `/arcanum-migrate` skill can drive it by asking in chat instead of relying on live TTY relay through a tool call (the same reason `/arcanum-update` splits `run_update.sh check`/`apply` from the underlying `bootstrap.sh`/`installer.sh` prompts). Errors are collected in `.claude/state/arcanum-errors.json` (overwritten fresh per `run.sh` invocation, not appended) and printed at the end of the run regardless of whether any were skippable.

**Version tracking:** the repo's current migration-version is `.version` in `.claude/configuration/arcanum-repo-config.json` (see the table above) — stamped by `init-claude`, advanced by `update_per_file.sh` after each migration it runs (success or skippable failure). See `docs/guides/arcanum-repo-version.md` for the missing/invalid-semver fallback rules, and `docs/guides/arcanum-repo-config.md` for the config-file move this issue's own migration (`001.sh`) performs.
