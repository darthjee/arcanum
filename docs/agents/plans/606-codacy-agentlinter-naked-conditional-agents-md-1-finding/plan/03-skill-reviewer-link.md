# Point skill-reviewer at the shared criteria

In `.claude/agents/skill-reviewer.md`'s "What to review" list:

- Item 2: replace the inline "Examples of complex logic" sub-list with a reference to the **Must be extracted** criteria in [Script Preference](../../docs/agents/architecture/script-preference.md#allowed-inline-vs-must-extract).
- Item 3: replace the inline "Do not flag" sub-list with a reference to the **Allowed inline** criteria in the same section.

Keep the rest of the file unchanged: scope, report format, and the "do not make changes" rules.

## Files to Change

- `.claude/agents/skill-reviewer.md` — replace the duplicated criteria lists with links to `script-preference.md`.
