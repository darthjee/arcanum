# Scripter Plan: discuss-issue render_issue expands $ patterns in section text

Main plan: [plan.md](plan.md)

## Shared contracts

Implements the shell side of the plan's **Substitution semantics** for both
placeholder sets. Node's parity specs run these scripts directly
(`render_issue_shell.sh`, `reply_comment_shell.sh`) with the hostile fixture, under
whatever `bash` is on `PATH` (≥ 5.2 locally).

## Implementation Steps

### Step 1 — Single-pass perl substitution in `render_issue_shell.sh`

Replace the six `content="${content/\%\%X\%\%/$X}"` lines (31-36) with one perl
pass that reads values from per-call env vars, e.g.:

```bash
content=$(R_TITLE="$TITLE" R_DESCRIPTION="$DESCRIPTION" R_PROBLEM="$PROBLEM" \
  R_EXPECTED_BEHAVIOR="$EXPECTED_BEHAVIOR" R_SOLUTION="$SOLUTION" R_BENEFITS="$BENEFITS" \
  perl -0777 -pe 's/%%(TITLE|DESCRIPTION|PROBLEM|EXPECTED_BEHAVIOR|SOLUTION|BENEFITS)%%/$ENV{"R_$1"}/g' "$TEMPLATE")
```

Use prefix assignments, not `export`. The interpolated `$ENV{...}` value is
inserted verbatim and never re-scanned, which covers both the `&`/`\` bug and
placeholder injection. Leave the existing blank-line-collapse perl and the
`printf '%s\n'` write unchanged. Check that output is byte-identical to the old
script on plain input (no `$`/`&`/`\`). Update the header comment to say why
perl is used instead of `${var/…/…}` (`patsub_replacement` on bash ≥ 5.2).

### Step 2 — Same fix in `reply_comment_shell.sh`

Replace lines 53-56 the same way, with `BODY`, `AGENT`, `MODEL_NAME` and
`MODEL_EMAIL` (`R_BODY="$REPLY_BODY"`, …), keeping the `content=$(…)` capture
and the `printf '%s\n' "$content" | gh pr comment …` pipe unchanged. Like before,
`$(…)` only trims trailing newlines from the end of the whole document, and the
template ends with the attribution line.

## Files to Change

- `discuss-issue/scripts/render_issue_shell.sh` — single-pass perl substitution, header comment.
- `auto-fix-all/scripts/reply_comment_shell.sh` — single-pass perl substitution.

## Notes

- Don't use `shopt -u patsub_replacement` or quoted replacements
  (`${c/p/"$V"}`): the quotes are kept literally on bash 3.2 (verified), and
  neither option fixes placeholder injection.
- Verify manually under both `/bin/bash` (3.2) and `/opt/homebrew/bin/bash` (5.3)
  with the hostile fixture from plan.md.
