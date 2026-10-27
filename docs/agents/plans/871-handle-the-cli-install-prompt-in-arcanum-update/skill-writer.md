# Skill-writer Plan: Handle the CLI install prompt in /arcanum-update

Main plan: [plan.md](plan.md)

## Shared contracts

- `scripts/run_update.sh apply` exit `4`: the arcanum update **succeeded**; its streamed stdout contains `FALLBACK=chat`, `CLI_VERSION=<v>`, optionally `CLI_INSTALLED=<v>`, and ends with the usual `RESULT=` line.
- `scripts/run_update.sh install-cli <v>`: runs the client step with `--no-confirm`; exit `0` for every outcome (its stderr carries `arcanum-cli:` lines), `1` usage.

## Implementation Steps

### Step 1 — Exit-4 branch in arcanum-update/SKILL.md Step 3

Rework Step 3's outcome list:

- **Exit 0** — unchanged.
- **Exit 4** — the arcanum update succeeded and the client step wants a yes:
  1. Report the `RESULT=` line exactly as on exit `0` (version change + "Start a new Claude Code session to pick up new or renamed skills.").
  2. Read `CLI_VERSION` and, if present, `CLI_INSTALLED` from the streamed output.
  3. Ask once with `AskUserQuestion`: `Install arcanum-cli@<CLI_VERSION> with npm i -g?`, or, with `CLI_INSTALLED`, `Update arcanum-cli from <CLI_INSTALLED> to <CLI_VERSION> with npm i -g?`; options **Yes**, **No**, **Chat**.
     - **Yes** → run `scripts/run_update.sh install-cli <CLI_VERSION>` and relay its output (stderr `arcanum-cli:` lines) verbatim; it never reports the arcanum update as failed.
     - **No** or a dismissed/rejected question → print the manual command `npm i -g arcanum-cli@<CLI_VERSION>`.
     - **Chat**, or a free-text "Other" answer → return to the conversation (no install).
     - `AskUserQuestion` unavailable (headless, tool denied) → print the manual command and end.
  4. Ask at most once; never a free-text chat yes/no.
- **Any other nonzero exit** — the existing failure text (relay error, safely retryable, no auto-retry).

Explain in one sentence that the TTY side is already handled by `install_cli.sh` (it asks on `/dev/tty` when there is one), so exit `4` only happens with no TTY — this is the `AskUserQuestion` fallback half of the TTY-first pattern that `skill-reviewer` checks. Update the skill's `description` frontmatter only if it lists outcomes (keep it short). Keep `scripts/run_update.sh` resolution note as is.

## Files to Change
- `arcanum-update/SKILL.md` — Step 3: exit-`4` branch, "any other nonzero exit" wording.

## Notes
- Have `skill-reviewer` check the new branch (exit-4 `FALLBACK=chat` handled with `AskUserQuestion`, no inline deterministic logic).
