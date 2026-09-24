# Script Preference

Deterministic logic — parsing, file mutation, API calls, validation, any step that must produce the same output for the same input — must live in shell scripts inside `<skill>/scripts/`, not in markdown instructions relying on AI judgment.

Scripts are invoked from markdown steps with explicit arguments. This means:

- No ambient reasoning required to execute a step correctly.
- Edge cases are handled once, in the script, not re-interpreted on every run.
- Token usage per run is reduced — the AI reads a one-liner invocation, not a paragraph of prose.

**Guideline:** when adding a new skill or extending an existing one, apply the concrete test in [Allowed inline vs. must extract](#allowed-inline-vs-must-extract) below. Anything matching a **Must be extracted** criterion, or not covered by an **Allowed inline** one, goes into a script — it could produce a wrong result due to AI misinterpretation.

## Allowed inline vs. must extract

This section is the single source of truth for what may stay inline in skill markdown (`SKILL.md` and auxiliary `steps/*.md` files). The `skill-reviewer` agent applies these same criteria.

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
