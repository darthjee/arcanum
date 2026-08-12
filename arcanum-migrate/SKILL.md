---
name: arcanum-migrate
description: Walks this repo through pending per-repo structural changes (renamed/moved config files, new folders, new config shapes) introduced by newer arcanum versions since this repo's arcanum install last caught up — distinct from `/arcanum-update`, which updates the arcanum install itself, not artifacts inside this consuming repo. Reads the repo's recorded arcanum version from `.claude/configuration/arcanum-repo-config.json`, then drives a single interactive script that lists pending migrations and prompts directly in the terminal ([A]ll/[N]one/[S]elect/[C]hat) before applying them. Usage: /arcanum-migrate
---

You are acting as the **architect**. Your job is to walk this repo through any pending per-repo migrations for the arcanum install it lives inside, via a single call into the deterministic script chain, which owns the whole check → confirm → apply flow itself through `/dev/tty` — including a `[C]hat` escape hatch back to you when the user wants to discuss a version/file before deciding.

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to every call below.

## Step 1 — Warn about the terminal prompt, then make the single call

Tell the user, immediately before the call, that they're about to be prompted directly in their terminal — not in this chat box — for `[A]ll/[N]one/[S]elect/[C]hat`.

Then make exactly one call:

```bash
../arcanum/migrations/run.sh --repo "$REPO_PATH"
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`).

This single call owns the entire interactive flow — listing the current/pending versions, prompting `[A]ll/[N]one/[S]elect` (and `[C]hat` at every level of the chain) via `/dev/tty`, applying whatever was chosen, and printing any collected errors at the end. The user answers directly in their terminal; you only see the full output once the call returns.

Once the call returns, relay its full captured stdout/stderr verbatim into the chat transcript (never summarized away, even though the user already saw it live in their terminal) — this includes the `CURRENT`/pending list, the prompt and chosen answer, every migration line, and any error-file dump. On top of that raw relay, add a short plain-language summary of the final outcome. Then branch on the exit code:

- **Exit `0`** — completed cleanly (parse the relayed output for an "up to date" vs. "advanced to `<version>`" summary; it may still have recorded skippable errors, already visible in the relay). Done — stop here.
- **Exit `1`** — halted (a non-skippable migration failed, a usage/no-TTY/invalid-`--repo` error occurred, or the recorded version isn't valid semver); report the relayed error, note it's safely re-runnable since migrations are idempotent — `/arcanum-migrate` will resume from the same point. Done — stop here.
- **Exit `3`** — `[C]hat` requested; continue to Step 2.

## Step 2 — Chat detour, then resume

Parse `CHAT_CONTEXT=<version>[/<file>]` from the relayed output — the most specific thing the user asked about (a bare version, or a version plus a specific migration file). If a file is identified, read its paired `.md` description (same basename, `.sh` replaced with `.md`) when present, and hold a plain chat dialogue with the user about it — no `AskUserQuestion`, just ordinary conversation.

Once the user has decided what to do, resume with the existing non-interactive form — no re-entry into the `/dev/tty` prompt:

```bash
../arcanum/migrations/run.sh apply --all|--none|--select <version> --repo "$REPO_PATH"
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`), same as Step 1.

Relay this call's output the same way as Step 1, then branch on its exit code the same way (`0`/`1` both terminal here — `apply` never itself exits `3`, since the chat detour was already resolved before this call).
