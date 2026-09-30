---
name: arcanum-migrate
description: Walks this repo through pending per-repo structural changes (renamed/moved config files, new folders, new config shapes) introduced by newer arcanum versions since this repo's arcanum install last caught up — distinct from `/arcanum-update`, which updates the arcanum install itself, not artifacts inside this consuming repo. Reads the repo's recorded arcanum version from `.claude/configuration/arcanum-repo-config.json`, then drives a single interactive script that lists pending migrations and prompts in the terminal ([A]ll/[N]one/[S]elect/[C]hat), or via `AskUserQuestion` when no terminal is available, before applying them. Usage: /arcanum-migrate
---

You are acting as the **architect**. Your job is to walk this repo through any pending per-repo migrations for the arcanum install it lives inside, via a single call into the deterministic script chain, which owns the whole check → confirm → apply flow itself through `/dev/tty` when a terminal is available (falling back to an `AskUserQuestion` in this chat when it isn't) — including a `[C]hat` escape hatch back to you when the user wants to discuss a version/file before deciding, and an unconditional `AI_INSTRUCTIONS` hand-off back to you whenever the chain reaches a `type: "instructions"` manifest entry (one whose work only an AI can perform, not a bash script).

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd — and thread it through explicitly to every call below.

## Step 1 — Warn about the terminal prompt, then make the single call

Tell the user, immediately before the call, that they're about to be prompted in their terminal — not in this chat box — for `[A]ll/[N]one/[S]elect/[C]hat` if one is available; otherwise (no terminal, e.g. inside a Claude Code session) the question will come here in the chat instead.

Then make exactly one call:

```bash
../arcanum/migrations/run.sh --repo "$REPO_PATH"
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`).

This single call owns the entire interactive flow — listing the current/pending versions, prompting `[A]ll/[N]one/[S]elect` (and `[C]hat` at every level of the chain) via `/dev/tty`, applying whatever was chosen, and printing any collected errors at the end. The user answers directly in their terminal; you only see the full output once the call returns. When no terminal is available, the call returns immediately with exit `4` instead (see Step 1b).

Once the call returns, relay its full captured stdout/stderr verbatim into the chat transcript (never summarized away, even though the user already saw it live in their terminal) — this includes the `CURRENT`/pending list, the prompt and chosen answer, every migration line, and any error-file dump. On top of that raw relay, add a short plain-language summary of the final outcome. Then branch on the exit code:

- **Exit `0`** — completed cleanly (parse the relayed output for an "up to date" vs. "advanced to `<version>`" summary; it may still have recorded skippable errors, already visible in the relay). Done — stop here.
- **Exit `1`** — halted (a non-skippable migration failed, a usage/invalid-`--repo` error occurred, the terminal was closed mid-prompt, or the recorded version isn't valid semver); report the relayed error, note it's safely re-runnable since migrations are idempotent — `/arcanum-migrate` will resume from the same point. Done — stop here.
- **Exit `3`** — hand-off requested; parse whether the relayed output's last line is `CHAT_CONTEXT=<version>[/<file_or_id>]` or `AI_INSTRUCTIONS=<version>/<id>` and continue to the matching branch of Step 2 below.
- **Exit `4`** — no terminal available (`FALLBACK=chat`); nothing was applied and no prompt was shown. Continue to Step 1b below.

## Step 1b — No terminal: ask with `AskUserQuestion`

On exit `4` the output is only machine-readable lines: `FALLBACK=chat`, `CURRENT=<version>`, `LOCAL=<version>`, `GLOBAL=<version>`, then one `PENDING=<version>` line per pending version (ascending). Relay it as in Step 1, then ask once with `AskUserQuestion` — the question names the current version and every pending version, with options **All**, **None**, **Select**, **Chat** — and act on the answer:

- **All** → `../arcanum/migrations/run.sh apply --all --repo "$REPO_PATH"`.
- **None** → nothing runs. Done — stop here.
- **Select** → ask a second `AskUserQuestion` listing the pending versions in ascending order as options (at most 4; the automatic "Other" lets the user type any other pending version). Run `../arcanum/migrations/run.sh apply --select <version> --repo "$REPO_PATH"`. On exit `0`, run `../arcanum/migrations/run.sh check --repo "$REPO_PATH"`; while its output still has `PENDING=` lines, ask again with the remaining versions plus a **Done** option (Done → stop). Stop when nothing is pending.
- **Chat** → the version-level `CHAT_CONTEXT=` branch of Step 2 (empty context: nothing selected yet).
- A free-text "Other" answer on the first question → **Chat**, with the text as context.
- A dismissed or rejected question → **None**.
- If `AskUserQuestion` is unavailable (headless, tool denied), print the pending versions and the manual commands — `../arcanum/migrations/run.sh apply --all --repo "$REPO_PATH"` and `../arcanum/migrations/run.sh apply --select <version> --repo "$REPO_PATH"` — then end.

Never replace this with a free-text yes/no question in the chat — always use `AskUserQuestion`.

Relay every `apply` call made from this step and branch on its exit code exactly as in Step 2 (`0`/`1` terminal, `3` → the matching hand-off branch, which then resumes via `apply` as usual). In this mode selection is per version only: `apply --select <version>` runs all of that version's pending entries without per-entry prompts. If the user wants to discuss a version or its entries first, they choose **Chat** before deciding.

## Step 2 — Hand-off, then resume

Both branches below resume the same way once they're done deciding/acting — no re-entry into the `/dev/tty` prompt:

```bash
../arcanum/migrations/run.sh apply --all|--none|--select <version> --repo "$REPO_PATH"
```

> Resolve `../arcanum/migrations/run.sh` relative to this skill's own folder (`arcanum-migrate/`), same as Step 1.

Relay this call's output the same way as Step 1, then branch on its exit code the same way (`0`/`1` both terminal here — `apply` never itself exits `3` for a `script`/plain `[C]hat` resume; it can still exit `3` again for an `AI_INSTRUCTIONS`/instructions-`[C]hat` hand-off further into the same version's manifest — loop back into the matching branch below when that happens).

### `CHAT_CONTEXT=<version>[/<file_or_id>]` — open-ended discussion

First, tell apart which of three shapes this is: no second segment (a bare `CHAT_CONTEXT=<version>`, or entirely empty for a not-yet-version-selected `[C]hat`) is a version-level discussion, nothing entry-specific yet; a second segment ending in `.sh` (e.g. `CHAT_CONTEXT=<version>/002.sh`) is a `script` entry; a second segment with no `.sh` suffix (e.g. `CHAT_CONTEXT=<version>/002`) is an `instructions` entry's id — handled by "`[C]hat` on an instructions entry" below instead of this branch.

For a version-level or `script`-entry discussion (unchanged behavior): read the `script` entry's paired `.md` description (same basename, `.sh` replaced with `.md`) when present, and hold a plain chat dialogue with the user about it — no `AskUserQuestion`, just ordinary conversation. Once the user has decided what to do (including doing nothing), resume with `run.sh apply` above.

### `AI_INSTRUCTIONS=<version>/<id>` — autonomous hand-off (new)

Reached whenever an `instructions`-type manifest entry is hit via `[R]un` (or under `--no-confirm`) — not optional the way `[C]hat` is, since a bash script cannot perform this entry's work itself:

1. Read `../arcanum/migrations/repos/<version>/<id>.instructions.md` (resolved the same way as `run.sh` above) — the AI-facing content, never shown at the terminal prompt.
2. Perform the work it describes, autonomously — no further user confirmation beyond the original `[R]un` choice (or `--no-confirm`) that triggered this hand-off.
3. Mark it done: `../arcanum/migrations/ledger.sh mark-complete "$REPO_PATH" <version> <id>`.
4. Resume with `run.sh apply --select <version> --repo "$REPO_PATH"` above (not `--all`/`--none` — a hand-off always identifies a specific version to resume).

### `[C]hat` on an instructions entry (new)

`CHAT_CONTEXT=<version>/<id>` where `<id>` has no `.sh` suffix (see the discriminator above) means the user chose `[C]hat` on an `instructions` entry specifically. Since `[R]un` already means "hand this entry to the AI," `[C]hat` here means something narrower — a conversation about the entry, reading its `<id>.md` description (not the AI-only `<id>.instructions.md`, unless/until the outcome below decides to actually perform it) before committing to anything:

- **Satisfied by discussion alone** — nothing runs; resume with `run.sh apply` above without marking the ledger. The entry stays pending (it'll come up again next time this version is (re)applied).
- **User proposes an alternative** — perform that alternative directly instead of the literal instructions, then `ledger.sh mark-complete "$REPO_PATH" <version> <id>` (same call as the autonomous branch above — the entry's intent was satisfied, just not via the literal file), then resume.
- **User wants both** — perform the alternative and the original `<id>.instructions.md` content, in whichever order the user asked for, then `ledger.sh mark-complete`, then resume.

In every outcome you decide yourself when the entry is done and whether to mark the ledger — there's no re-entry into the `/dev/tty` prompt to reconcile back with the script chain's own state.
