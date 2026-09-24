# Define the threshold in Script Preference

Add a `## Allowed inline vs. must extract` section to `docs/agents/architecture/script-preference.md`, after the existing **Guideline** paragraph. It becomes the single source of truth for what may stay inline in skill markdown.

Content, moved from `.claude/agents/skill-reviewer.md`:

- **Allowed inline:**
  - A single command with flags (e.g. `gh issue list --label bug`).
  - Two commands chained with `&&` or `||` in a simple, obvious way.
  - A call to an existing script under `<skill>/scripts/` or `arcanum/_lib/`.
  - A command that only prints or reads a variable.
- **Must be extracted** into `<skill>/scripts/*.sh` or `arcanum/_lib/`:
  - A multi-stage pipeline (`cmd1 | cmd2 | cmd3 | ...`) doing non-trivial parsing or transformation.
  - A loop (`for`, `while`) or conditional (`if`/`case`) with a multi-line body.
  - Process substitution or a heredoc used for data manipulation.
  - A command sequence with intermediate variables used for validation or parsing.

Update the **Guideline** paragraph so it refers to this section as the concrete test, instead of relying only on the open-ended "could this step produce a wrong result…" question.

## Files to Change

- `docs/agents/architecture/script-preference.md` — add the threshold section and tie the Guideline to it.
