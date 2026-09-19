# Issue: Codacy: misc markdownlint singles — MD012/MD025/MD036/MD038/MD047 (5 findings)

## Description

Codacy's markdownlint flags 5 one-off findings, each a different rule, in 5 different files — bundled here since each is a single, independent fix.

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool markdownlint.

## Findings

| File | Line | Pattern | Message |
|------|------|---------|---------|
| `README.md` | 5 | `markdownlint_MD012` | Multiple consecutive blank lines (Expected: 1; Actual: 2) |
| `init-claude/setup_permissions.md` | 33 | `markdownlint_MD025` | Multiple top-level headings in the same document |
| `docs/agents/architecture/script-engine.md` | 48 | `markdownlint_MD038` | Spaces inside code span elements |
| `auto-fix-all/templates/reply.tmpl.md` | 3 | `markdownlint_MD036` | Emphasis used instead of a heading |
| `ISSUE_TEMPLATE.md` | 24 | `markdownlint_MD047` | Files should end with a single newline character |

## Expected Behavior

- `README.md`: collapse the two consecutive blank lines (lines 4-5) into one.
- `init-claude/setup_permissions.md`: this file actually bundles two independent, self-contained onboarding procedures (each with its own H1 title and its own Step 1/2/3 sub-structure) — split it into two files instead of just demoting the second heading:
  - `init-claude/setup_permissions.md` keeps the `shipit`-Merge Permission Exemption procedure.
  - `init-claude/setup_specialist_dispatch_permissions.md` gets the Common Specialist-Dispatch Permission Exemption procedure.
  - Update `init-claude/SKILL.md`'s Step 11 to read both files.
  - Update the other places that reference `init-claude/setup_permissions.md` by name (`arcanum/_lib/permission_grant.sh`, `arcanum/_lib/permission_grant_shell.sh`, `docs/agents/architecture/issue-tags.md`, `docs/agents/architecture/dispatch-permissions.md`, `auto-fix-all/scripts/wait_ci_and_merge_shell.sh`) so any that specifically mean the specialist-dispatch procedure point at the new file.
- `docs/agents/architecture/script-engine.md`: remove the stray trailing space inside the `` `arcanum: ` `` code span on line 48.
- `auto-fix-all/templates/reply.tmpl.md`: the `_Replied by: ..._` line is an intentional italic signature style for a rendered PR reply comment, not a mislabeled heading — suppress MD036 for that line inline (e.g. a `<!-- markdownlint-disable-line MD036 -->`-style comment) rather than converting it to a real heading.
- `ISSUE_TEMPLATE.md`: add a trailing newline at end of file.
- Re-running markdownlint/Codacy shows zero findings at these locations.

## Solution

Five small, independent fixes — no shared root cause, safe to batch into a single PR. The `init-claude/setup_permissions.md` fix is the only one wider than a single line, since it involves splitting the file and updating its cross-references.
