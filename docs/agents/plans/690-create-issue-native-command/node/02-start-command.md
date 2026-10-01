# `arcanum-create-issue-start` command

New `core/lib/commands/arcanum-create-issue/ArcanumCreateIssueStart.js` (`run`), per the spec's
"`arcanum-create-issue-start`" section:

- Preflight: GitHub auth/token available and `origin` resolves to a GitHub remote; otherwise
  `STATUS=error`, `ERROR=<message>`, exit `1`, no draft.
- Drafts dir: `<repo>/.claude/state/create-issue/`; new draft named `<timestamp>.md` (sortable,
  filesystem-safe timestamp).
- No drafts → create, `STATUS=new`, `FILE=<path>`.
- Drafts + TTY → prompt (`[N]ew` or draft number) listing timestamp, age and title/first line;
  print `STATUS=new|resumed`, `FILE=`.
- Drafts + no TTY → exit `4`, `FALLBACK=chat`, `DRAFT=<path>\t<timestamp>\t<title or first line>`
  per draft, newest first.
- `--new` / `--resume <draft>` skip the prompt; unknown resume path → exit `2`; bad args → exit `2`.

Unit specs cover each branch: new draft, resume (flag and prompt), exit `4` with `DRAFT=`
lines, preflight error, invalid args.

## Files to Change

- `core/lib/commands/arcanum-create-issue/ArcanumCreateIssueStart.js` — new
- shared draft helper (e.g. `core/lib/commands/arcanum-create-issue/DraftStore.js`) — list/create/read title/delete drafts, reused by publish
- a TTY prompt helper (injectable) if none exists yet
- `core/spec/lib/commands/arcanum-create-issue/ArcanumCreateIssueStart_spec.js` — new
