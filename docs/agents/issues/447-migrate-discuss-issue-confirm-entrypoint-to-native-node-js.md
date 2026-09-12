# Issue: Migrate discuss-issue-confirm entrypoint to native Node.js

## Description

Sub-issue of #446 (batch overview). Part of the `discuss-issue` family — migrating `discuss-issue/scripts/confirm.sh` (28 lines) to a native Node.js implementation, per the [Script Engine migration](docs/agents/architecture/script-engine.md).

### Source script

`discuss-issue/scripts/confirm.sh` — deterministically resolves a free-form yes/no-ish reply to a boolean, purely via exit code (no stdout). Usage: `confirm.sh "<free-form reply>"`.

- Trims surrounding whitespace and trailing punctuation (`. ! ?`), lowercases the reply, then matches it against a fixed affirmative list: `yes`, `y`, `sim`, `correct`, `"looks good"`, `sure`, `ok`, `okay`.
- Exit 0 when the normalized reply matches one of those affirmatives.
- Exit 1 for everything else — explicit negatives (`no`, `n`, `não`, `nao`, `nope`), anything unrecognized, and a missing/empty argument — "not recognized as affirmative" already means "no" for this contract.

## Solution

Follow `docs/agents/architecture/script-engine.md`:

1. Read `discuss-issue/scripts/confirm.sh` in full for its exact normalize/match/exit-code contract.
2. Create `core/lib/commands/discuss-issue/DiscussIssueConfirm.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'discuss-issue-confirm': { module: 'commands/discuss-issue/DiscussIssueConfirm.js', method: 'run' }` — this entrypoint touches no repo state, so the `context` key is omitted entirely (`'none'`/absent, per the registry's own convention — see `auto-fix-all-config-get`/`auto-fix-issue-list-plan-agents` for precedent), not `'repo'`.
4. Add `"discuss-issue-confirm": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js`, covering: each affirmative word/phrase (case-insensitive, with surrounding whitespace and trailing punctuation), each explicit negative, unrecognized input, and a missing/empty argument.
6. Write a parity test at `core/spec/bin/discussIssueConfirmParity_spec.js` (shell vs. native, identical exit code — this script has no stdout to compare).
7. Extract the current logic to `discuss-issue/scripts/confirm_shell.sh`, replace `discuss-issue/scripts/confirm.sh` with a thin `engine_dispatch.sh` shim (see `auto-fix-issue/scripts/merge_main.sh`/`merge_main_shell.sh` for the exact shape), and verify it routes correctly for `engine.mode=native` and `engine.mode=shell`.

### External dependencies

None — pure string normalization, no git/GitHub calls, no file I/O beyond its own argument.

### Reused by other skills

`confirm.sh` is called directly (not just from `discuss-issue`'s own steps) by:
- `arcanum-split-issue/steps/split.md` (confirming a sub-issue creation batch)
- `discuss-issue/steps/discuss_and_save.md` (its own primary use)
- `init-claude/setup_labels.md`

All three call sites resolve the same shared file path, so once migrated they automatically get the native path (once `engine.mode=native`) — no caller-side changes needed.

### Dependencies on other sub-issues

None in this batch — fully independent.
