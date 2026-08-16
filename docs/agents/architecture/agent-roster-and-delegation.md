# Agent Roster and Architect Delegation

## Agent Roster

Specialist agents are defined in `.claude/agents/`. The architect coordinates them; each specialist owns a clearly bounded scope.

| Agent | Scope | When the architect dispatches it |
|-------|-------|----------------------------------|
| `scripter` | `<skill-name>/scripts/` — writes and edits bash scripts | Whenever a skill needs deterministic logic extracted into a new or updated script |
| `skill-reviewer` | Reads skill files (SKILL.md + step `.md` files) changed in a PR and reports complex inline bash that violates the script-extraction rule | During PR review, after implementation, to validate that no complex logic was left inline |

`skill-reviewer` is a **read-only** agent: it never commits, never fixes violations — it only reports findings. The architect decides what to do (usually: dispatch `scripter` to extract the flagged logic).

## Architect Delegation

A skill that's meant to run autonomously, with no user interaction (the `auto-*` family is the current example), should not just narrate "you are acting as the architect" and execute its own steps inline in whichever context invoked it — that context might be the general/coordinator context (a human typing the slash command directly, or a `/loop` re-entry), which then carries that reasoning forward across unrelated turns. Instead, split the skill into two layers:

- **`SKILL.md` (coordinator layer)** — thin. Parses arguments, resolves `REPO_PATH="$(pwd)"` (the one moment the target project's root can be trusted from ambient cwd — see [Repo Path Threading](repo-path-threading.md)), then spawns a real subagent:

  > Agent(subagent_type: "architect", prompt: "Read steps/run.md (resolved relative to the `<skill-name>` skill folder) and follow it. ARGUMENTS: <raw skill arguments> REPO_PATH: <resolved_path>")

  Waits for it, then relays its final report verbatim. Keep in the coordinator only what the `architect` agent's tool set (`Read, Edit, Write, Bash, Agent` — no `ScheduleWakeup`, no `AskUserQuestion`) genuinely cannot do itself — e.g. `auto-fix-all`'s `ScheduleWakeup`-based context clearing between issues, and its one user-facing question when a PR is closed without merging.
- **`steps/run.md` (architect layer)** — the actual step-by-step instructions (what used to be the `SKILL.md` body). This is what the spawned `architect` agent reads and follows. It parses `REPO_PATH` out of its own invocation prompt and threads it through every script call it makes.

When one of these skills is invoked **from inside another** (e.g. `auto-fix-all` running `auto-new-issue`'s logic as part of processing one issue), the caller is already running as an `architect` agent — it reads the callee's `steps/run.md` directly and follows it, without spawning a second nested `Agent(architect)`. Only the outermost, human/coordinator-facing invocation spawns the subagent. `REPO_PATH` is carried forward unchanged into that direct read too — never re-resolved from `pwd` partway through a run, since a nested step's ambient cwd can no longer be trusted (see [Repo Path Threading](repo-path-threading.md)).
