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
| `.claude/state/auto-monitor-pr-<pr_number>-comments.json` | Tracks owner comments seen by `auto-monitor-pr` for a given PR. One file per PR number. | `{"comments": [{"id": "<node_id>", "user": "<login>", "url": "<html_url>", "status": "open"\|"addressed"}], "last_comment_time": "<ISO8601>"}` |
| `.claude/configuration/auto-fix-all.json` | Configuration for the `auto-fix-all` skill. Controls which CI check names are ignored when deciding pass/fail. | `{"ignored_check_patterns": ["<substring>", ...]}` |

Never write to these files directly — always use the dedicated scripts (e.g. `queue.sh push`, `queue.sh pop`) that handle locking and atomicity.

## Issue Tags

Issue files (`docs/agents/issues/<id>-<name>.md`) may end with a trailing tags block:

```markdown
---

Tags: <list of tags>
```

Tags are free-form `:word:` tokens (e.g. `Tags: :shipit: :urgent:`), parsed by `_lib/tags.sh`'s `extract_tags`/`has_tag` helpers (case-insensitive, full-line match per tag). Skills never invent this block — it only exists when a GitHub fetch (`github.sh fetch`) found one in the issue body, and it is carried over verbatim by whichever skill wrote the file. Three of the tags below may also be written as an emoji instead of the `:word:` form — `extract_tags` normalizes the emoji to its canonical name internally, so `has_tag` and every other consumer never need to know which form was used.

**`:shipit:`** is the only tag with defined meaning today: it marks an issue as pre-approved, so `auto-fix-all` skips PR review/monitoring and merges directly once CI passes (checked via `has_shipit_tag.sh`/`has-shipit-label`, the same pre-approval signal as the GitHub issue's `shipit` label).

**`:question:` / ❓** marks an issue as having a question for the agent. `monitor-issues` detects it (via `_lib/tag_actions.sh`'s `actionable_tags`) and logs that it needs an answer — actually answering it requires AI judgment, so that step is left to architect-level reasoning, not the polling script. Once answered, the tag should be removed from the live GitHub issue body via `monitor-issues/scripts/github.sh remove-tag <id> question`.

**`:pencil2:` / ✏️** marks an issue as ready to be read and rewritten by the agent. `monitor-issues` detects it the same way and logs that a rewrite is needed; the rewrite itself is architect-level (AI judgment), and once done the tag is removed via `monitor-issues/scripts/github.sh remove-tag <id> pencil2` and the GitHub issue body is updated.

**`:clipboard:` / 📋** marks an issue as ready to be pushed to the `auto-fix-all` queue. Unlike the two tags above, this action is fully deterministic, so `monitor_issues.sh` performs it directly: it pushes the issue id via `auto-fix-all/scripts/queue.sh push <id>` as soon as the tag is detected.

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
