# Skill-writer Plan: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

Main plan: [plan.md](plan.md)

## Shared contracts

- `run.sh --repo "$REPO_PATH"` may exit `4` with stdout `FALLBACK=chat`, `CURRENT=`, `LOCAL=`, `GLOBAL=`, one `PENDING=<version>` per pending version (ascending).
- Exit `1` no longer means "no TTY".
- The `AskUserQuestion` answer mapping table in [plan.md](plan.md#shared-contracts) is authoritative.

## Implementation Steps

### Step 1 — Step 1 wording and the exit-`4` branch
In `arcanum-migrate/SKILL.md`:
- Reword the pre-call warning: the user will be prompted in their terminal for `[A]ll/[N]one/[S]elect/[C]hat` if one is available; otherwise the question comes in the chat.
- Drop "no-TTY" from the exit-`1` bullet.
- Add an **Exit `4`** bullet pointing to a new section (e.g. "Step 1b — No terminal: ask with `AskUserQuestion`") that implements the mapping table from [plan.md](plan.md#shared-contracts): relay the output, ask All / None / Select / Chat naming the current and pending versions, and handle Select's version loop via `run.sh apply --select` + `run.sh check` with a **Done** option. Include the free-text "Other" → Chat, dismissed → None, and `AskUserQuestion` unavailable → print manual commands rules. Free-text chat yes/no stays forbidden.
- State that every `apply` call from this branch is relayed and branched on exactly as in Step 2 (so `AI_INSTRUCTIONS`/`CHAT_CONTEXT` hand-offs, which then resume via `apply`, keep working).
- Mention that in fallback mode selection is per version: `apply --select <version>` runs all of that version's pending entries without per-entry prompts; the user can choose Chat first to discuss.

### Step 2 — Frontmatter description
Update the `description:` in the frontmatter so it no longer says the prompt is always in the terminal (e.g. "prompts in the terminal, or via `AskUserQuestion` when no terminal is available").

## Files to Change
- `arcanum-migrate/SKILL.md` — exit-`4` fallback branch, Step 1 warning wording, exit-`1` wording, frontmatter description.

## Notes
- Keep deterministic logic out of the markdown: the skill only maps answers to existing `run.sh` subcommands. `skill-reviewer` already checks that `/dev/tty`-owning script callers handle exit `4` (added in #681).
