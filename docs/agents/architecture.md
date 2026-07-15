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

- **`SKILL.md` (coordinator layer)** — thin. Parses arguments, then spawns a real subagent:

  > Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `<skill-name>` skill folder) and follow it. ARGUMENTS: <raw skill arguments>")

  Waits for it, then relays its final report verbatim. Keep in the coordinator only what the `architect` agent's tool set (`Read, Edit, Write, Bash, Agent` — no `ScheduleWakeup`, no `AskUserQuestion`) genuinely cannot do itself — e.g. `auto-fix-all`'s `ScheduleWakeup`-based context clearing between issues, and its one user-facing question when a PR is closed without merging.
- **`steps/run.md` (architect layer)** — the actual step-by-step instructions (what used to be the `SKILL.md` body). This is what the spawned `architect` agent reads and follows.

When one of these skills is invoked **from inside another** (e.g. `auto-fix-all` running `auto-new-issue`'s logic as part of processing one issue), the caller is already running as an `architect` agent — it reads the callee's `steps/run.md` directly and follows it, without spawning a second nested `Agent(architect)`. Only the outermost, human/coordinator-facing invocation spawns the subagent.

## Shared State & Configuration Files

Skills store runtime state and configuration under `.claude/`:

| File | Purpose | Schema |
|------|---------|--------|
| `.claude/state/auto-fix-all-queue.json` | Queue of issue IDs to be processed by `auto-fix-all`. The first element is always the currently in-progress entry. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/auto-fix-all-queue.lock` | Lock file used during `push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/issue-<id>.json` | Unified per-issue state file used by `auto-fix-issue`, `monitor-issues`, and `auto-monitor-pr`. `auto-fix-issue` writes the `step` field after each completed step so the skill can resume on re-invocation. `monitor-issues` stores per-issue `updated_at` and `tags` here (replacing its own `issues.json` entry). `auto-monitor-pr` stores `pr_comments` and `last_comment_time` here when called with an issue id (replacing the legacy per-PR file). | `{"step": "<step_name>", "updated_at": "<ISO8601>", "tags": ["<tag>", ...], "pr_comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "state": "fetched\|processing\|addressed", "emojis": ["<:emoji_name:>"]}], "last_comment_time": "<ISO8601>"}` — all fields optional |
| `.claude/state/auto-monitor-pr-<pr_number>-comments.json` | **Deprecated.** Legacy per-PR comments file used by `auto-monitor-pr` when no issue id is supplied. New invocations should pass an issue id and use `.claude/state/issue-<id>.json` instead. | `{"comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open"\|"addressed"}], "last_comment_time": "<ISO8601>"}` |
| `.claude/configuration/auto-fix-all.json` | Configuration for the `auto-fix-all` skill. Controls which CI check names are ignored when deciding pass/fail. | `{"ignored_check_patterns": ["<substring>", ...]}` |
| `.claude/state/monitor-issues-rewrite-queue.json` | Queue of issue IDs awaiting a `:pencil2:` rewrite, drained by `auto-rewrite-issue`. | `[{"id": "<issue_id>"}, ...]` |
| `.claude/state/monitor-issues-rewrite-queue.lock` | Lock file used during `rewrite_queue.sh push`/`pop` mutations to prevent concurrent writes. Contains the acquiring instance's unique ID. | Plain text (instance ID string) |
| `.claude/state/init-claude-config.json` | Created by `init-claude`'s `setup_labels.md` step, in the **target repo being initialized** (not Arcanum's own state, unlike the other rows in this table). Stores the label/color table `init-claude/scripts/sync_labels.sh` renders and syncs to GitHub, so the script needs no CLI arguments to know the current table. Auto-populated with the standard 10 labels (including `Fetched`, backing the `eyes` issue tag) by `init-claude/scripts/lib/label_config.sh`'s `label_config_ensure_defaults` function whenever the file is missing or its `labels` array is empty; `init-claude/scripts/write_label_config.sh <replace\|remove\|add> <config_path> ...` mutates it during a user-driven refinement loop — `replace` overwrites the whole `labels` array, `remove` deletes named labels, `add` upserts `<name>:<color>` pairs. | `{"labels": [{"name": "<label name>", "color": "<hex color, no leading '#'>"}, ...]}` |

Never write to these files directly — always use the dedicated scripts (e.g. `queue.sh push`, `queue.sh pop`) that handle locking and atomicity.

## Branch Bootstrap and Merge Conflicts

`_lib/git_branch.sh` exposes two shared functions used whenever a skill needs to bring an issue branch up to date with `main`: `git_branch_fetch_main` (fetches `origin main`, tolerating a missing remote ref) and `git_branch_merge_main` (fetches, then merges `origin/main` into whatever branch is currently checked out via `git merge --no-edit`, without aborting on conflict — it leaves the conflict markers in place and reports the conflicted paths).

- `auto-fix-all/scripts/checkout_from_main.sh <id>` uses it to bootstrap the `issue-<id>` branch at the start of `process_one_issue.md`: it reuses the branch (local or remote) merged up to date with `origin/main` when it already exists — e.g. because `discuss-issue` committed an issue file and/or plan to it earlier — and only creates it fresh from `origin/main` when it doesn't exist at all. It never unconditionally discards an existing branch.
- `auto-fix-issue/scripts/merge_main.sh` uses it in `auto-fix-issue/steps/run.md`'s Step 2, right after the branch is checked out and before any specialist agent is dispatched, so implementation always starts from a branch merged up to date with `main`.

Both scripts print `STATUS=ok` or `STATUS=conflict` (plus the conflicted-file list on conflict) and exit `0`/`2` accordingly. On `STATUS=conflict`, the calling `.md` step applies the same responsible-agent-selection approach `handle_comment.md`'s "Choosing the responsible agent(s)" section already uses for PR comments and CI failures — treating each conflicted path like a failed check-run name — to resolve the conflict and commit, with no user interaction.

`auto-fix-all/SKILL.md`'s "closed PR" reimplement path is the one case that still wants a truly clean branch: since the user explicitly asked to start over, it runs `scripts/github.sh cleanup-branch <id>` to delete the rejected branch *before* looping back to `process_one_issue.md`, so the reuse-based bootstrap above finds nothing to reuse and creates a fresh branch.

## Cross-Skill References

Skills may reference another skill's `steps/*.md` or `scripts/*.sh` directly via a relative path, rather than duplicating logic — e.g. `auto-fix-all/steps/handle_comment.md` calls `auto-plan-issue/scripts/list_agents.sh`, and `auto-fix-all/steps/process_one_issue.md` reads `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue`'s `steps/run.md` directly (as the architect, without spawning a nested `Agent(architect)` — see "Architect Delegation" above). `discuss-issue/steps/discuss_and_save.md` follows the same pattern: once the user confirms they want planning to start right after discussion, it calls `auto-fix-all/scripts/checkout_from_main.sh` (to bootstrap the branch) and `auto-new-issue/scripts/commit_issue.sh` (to commit+push the issue file), then reads `auto-plan-issue/steps/run.md` directly, before pushing again — carrying discussion context straight into a committed plan without a separate `/auto-plan-issue` invocation losing it.

## Issue Tags

Issue status is tracked via real GitHub labels on the issue — labels are the sole source of truth; there is no body-embedded tags block. Reading a tag means checking whether a specific label is present on the issue's `labels`; writing a tag means adding or removing that label via `gh issue edit --add-label`/`--remove-label`. `_lib/tags.sh` defines the canonical-tag/label-name mapping (both directions) and exposes `extract_tags`/`has_tag`, which operate on a newline-separated list of label names (e.g. the output of `gh issue view ... --json labels -q '.labels[].name'`) rather than free body text — unrecognized labels are silently ignored.

| Canonical tag | GitHub label |
| --- | --- |
| `pencil2` | `Created` |
| `clipboard` | `Ready for Work` |
| `shipit` | `shipit` |
| `construction` | `Working` |
| `question` | `Question` |
| `eyes` | `Fetched` |

**`shipit`** is human-only: no script ever adds or removes the `shipit` label (`_lib/tag_mutate.sh` refuses any attempt at the shared-library level). It marks an issue as pre-approved, so `auto-fix-all` skips PR review/monitoring and merges directly once CI passes, checked via `auto-fix-all/scripts/github.sh has-shipit-label` — the pipeline's only interaction with this tag is reading it.

**`question`** marks an issue as having a question for the agent. `monitor-issues` detects it (via `_lib/tag_actions.sh`'s `actionable_tags`) and logs that it needs an answer — actually answering it requires AI judgment, so that step is left to architect-level reasoning, not the polling script. Once answered, the label should be removed from the live GitHub issue via `monitor-issues/scripts/github.sh remove-tag <id> question`.

**`pencil2`** marks an issue as ready to be read and rewritten by the agent. Unlike `question`, this action is now fully wired end-to-end: `monitor_issues.sh` pushes the issue id onto `monitor-issues/scripts/rewrite_queue.sh`'s queue (`.claude/state/monitor-issues-rewrite-queue.json`) as soon as the label is detected. The `auto-rewrite-issue` skill drains that queue: for each id it fetches the issue body, rewrites it (architect-level AI judgment, the same kind of rewrite `discuss-issue/steps/discuss_and_save.md` performs but fully autonomous), pushes the new body to GitHub, then removes the label via `monitor-issues/scripts/github.sh remove-tag <id> pencil2`.

**`clipboard`** marks an issue as ready to be pushed to the `auto-fix-all` queue, backed by the `Ready for Work` label (distinct from the plain `Ready` label, which developers may still use informally to mean "well-defined" without triggering auto-enqueuing). Unlike the two tags above, this action is fully deterministic, so `monitor_issues.sh` performs it directly: it pushes the issue id via `auto-fix-all/scripts/queue.sh push <id>` as soon as the label is detected.

**`eyes`** and **`construction`** are pipeline-status tags, not actionable ones — `monitor-issues` does not detect or act on them (they are not part of `_lib/tag_actions.sh`'s `ACTIONABLE_TAGS`). They exist purely so the GitHub issue list reflects `auto-fix-all`'s progress at a glance: `auto-fix-all` pushes `eyes` onto the live issue right after fetching/checking it (`auto-fix-all/steps/process_one_issue.md` step 2), then swaps it for `construction` once the implementation plan has been written and coding is about to start (step 3). This applies only to the `auto-fix-all` pipeline — the manual `/new-issue`, `/plan-issue`, and `/discuss-issue` skills never push either label.

### Tag mutation primitives

`_lib/tag_mutate.sh` exposes `tag_mutate_add_label <id> <repo_ref> <tag>` and `tag_mutate_remove_label <id> <repo_ref> <tag>`, which resolve the canonical tag name to a label via `_lib/tags.sh`, fetch the issue's current labels to decide whether the mutation is a no-op, and otherwise call `gh issue edit --add-label`/`--remove-label` directly — no body fetch/splice/push round-trip. Both refuse to mutate `shipit`. `monitor-issues/scripts/github.sh remove-tag` and `auto-fix-all/scripts/github.sh add-tag`/`remove-tag` are thin CLI wrappers around this shared library — new skills needing to mutate issue tags should add their own thin wrapper rather than re-implementing the label lookup/fetch logic.

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
