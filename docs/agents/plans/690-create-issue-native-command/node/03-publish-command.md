# `arcanum-create-issue-publish` command

New `core/lib/commands/arcanum-create-issue/ArcanumCreateIssuePublish.js` (`run`), per the spec's
"`arcanum-create-issue-publish`" section and "Edge cases":

- Args: `<draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`.
- Validation (exit `2`, nothing created): empty title, empty body (after stripping the draft's
  first `# ` heading), label empty / containing a comma / containing a newline.
- Labels: fetch repo labels (`GitHubLabelClient.listLabelNames`), match case-insensitively using
  the existing spelling, dedupe. Missing labels are created first (`Epic` → `fbca04`, others →
  `ededed`) with `WARNING=created label <name>` (Epic warning suggests `/arcanum-migrate`).
- Prompt 5 (final confirmation: title, labels, Epic yes/no, body line count, `[Y]es/[N]o/[C]hat`)
  unless `--confirmed`; prompt 6 (`shipit`, default No) only when `shipit` is requested and not
  `--shipit-confirmed`. No TTY → exit `4`, `FALLBACK=chat`. No/Chat at prompt 5 → nothing created
  (choose a distinct, documented status/exit for that — e.g. `STATUS=declined` exit `0` — and
  record it in the plan's shared contracts for #691). Unconfirmed `shipit` is dropped.
- Create once, with labels, through step 01's create path. No retry.
- Success: delete draft, print `STATUS=ok`, `ID`, `URL`, `LABELS`, `EPIC`, then `WARNING=` lines;
  delete failure → `WARNING=draft not deleted: <path>`, still exit `0`.
- Failure: exit `1`, `STATUS=failed`, `ERROR=<message>` telling the user to check GitHub before
  retrying; draft kept.

Unit specs: label normalization and dedupe, missing-label creation, single create call including
labels, no retry, draft deleted only on success, delete warning, title stripping, empty
title/body (exit `2`), exit `4` without `--confirmed` / `--shipit-confirmed`, `shipit` dropped
when not confirmed, all labels removed (`EPIC=false`).

## Files to Change

- `core/lib/commands/arcanum-create-issue/ArcanumCreateIssuePublish.js` — new
- `core/spec/lib/commands/arcanum-create-issue/ArcanumCreateIssuePublish_spec.js` — new
