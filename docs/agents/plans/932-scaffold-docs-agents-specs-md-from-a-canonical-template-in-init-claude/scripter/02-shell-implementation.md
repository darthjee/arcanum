# Shell implementation

In `setup_docs_structure_shell.sh`:

- Resolve `SCRIPT_DIR` and `TEMPLATES_DIR="${SCRIPT_DIR}/../templates"`.
- After `arcanum-split-issue.md`, handle `docs/agents/specs.md` (copy the template with `cp`, or skip it and print the stderr `Note:` line) and `docs/agents/specs/.gitkeep` (the missing/empty/non-empty/non-directory rules), exactly as in the shared contracts. Detect a non-empty directory including hidden entries, e.g. `[[ -n "$(ls -A docs/agents/specs 2>/dev/null)" ]]`.
- Replace the embedded `DOCS_SECTION` heredoc with `printf '\n' >> AGENTS.md; cat "${TEMPLATES_DIR}/agents-documentation-section.md" >> AGENTS.md`.
- In the `## Documentation`-present branch, print the stderr `Warning:` line when `grep -qF 'docs/agents/specs.md' AGENTS.md` fails.

Keep the existing stdout summary format and the exit code `0`.

## Files to Change
- `init-claude/scripts/setup_docs_structure_shell.sh` — new entries, template-based Documentation section, new note and warnings.
