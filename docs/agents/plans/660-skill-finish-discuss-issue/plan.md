# Plan: Skill finish: discuss-issue

Issue: [660-skill-finish-discuss-issue.md](../../issues/660-skill-finish-discuss-issue.md)

## Overview

This issue delivers the shared finish scripts that every `Skill finish:` sub-issue (#660–#667) depends on, then rewrites `discuss-issue`'s ending to use them. It implements the interfaces defined in [`docs/agents/specs/skill-finish.md`](../../specs/skill-finish.md), which is authoritative:

- `scripter` builds `arcanum/_lib/finish_report.sh` (engine-dispatch shim), `arcanum/_lib/finish_report_shell.sh`, and the `/dev/tty` prompt `arcanum/_lib/next_step_prompt.sh`.
- `node` builds the native `finish-report` command, a parity spec, and flips `finish-report` to `true`.
- `skill-writer` rewrites `discuss-issue`'s step 8 and adds reports to every exit path.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [skill-writer](skill-writer.md)

## Shared contracts

### `finish_report.sh` CLI (both engines, byte-identical)

```bash
arcanum/_lib/finish_report.sh <repo_path> --skill <name> --status success|declined|failed --summary "<text>" \
  [--issue <id>] [--pr <number>] [--sub-issue <id>]... \
  [--label-change <before_tag>:<after_tag>]... \
  [--next "<command>"]... [--merge "<nested block>"]... [--nested]
```

- Engine command name: `finish-report` (the `migration-status.json` key, and `core/bin/arcanum finish-report`). Native entry uses `context: 'repo'`. `<repo_path>` is only used to read `origin`: no network call and no GitHub token.
- Report (stdout, exit 0), one line each, with no blank lines and no trailing text:
  ```text
  == <skill>: <STATUS> ==
  <summary>
  Issue: #<id> https://<web-domain>/<owner>/<repo>/issues/<id>
  PR: #<n> https://<web-domain>/<owner>/<repo>/pull/<n>
  Sub-issues: #<a> #<b>
  Labels: <BeforeLabel> -> <AfterLabel>
  Next: <command>
  ```
  - `<STATUS>` is the upper-cased status.
  - `--summary` is trimmed and must be one line. An embedded newline is a usage error.
  - `Issue:`, `PR:` and `Sub-issues:` are printed only when set.
  - One `Labels:` line per label change, in order. An empty side prints `(none)`.
  - One `Next:` line per `--next`, in order.
- **Label names** come from the canonical-tag table: `arcanum/_lib/tags.sh` `_tag_label_for` in the shell engine, and `TAG_TO_LABEL` in `core/lib/utils/issue/Tags.js` in the native engine. An unknown tag, or `:` with both sides empty, is a usage error.
- **Web domain**: the origin domain from `origin.sh` `get_domain` / `Origin.js`, except that `ssh.github.com` (GitHub's ssh-over-443 host, which this repo's own origin uses) maps to `github.com`. Any other domain is used as-is.
- `--nested` prints this block instead of the report (exit 0). Keys appear in this order; the optional ones appear only when set, and repeat per value:
  ```text
  FINISH_SKILL=<skill>
  FINISH_STATUS=success|declined|failed
  FINISH_SUMMARY=<summary>
  FINISH_ISSUE=<id>
  FINISH_PR=<n>
  FINISH_SUB_ISSUE=<id>
  FINISH_LABEL_CHANGE=<before_tag>:<after_tag>
  ```
  `--next` is ignored under `--nested`. Label changes stay canonical tags in this block, not labels.
- `--merge "<block>"` (repeatable) merges nested result data into the caller's report:
  - The caller's `--skill`, `--status` and `--summary` are kept.
  - `Issue:` and `PR:` are filled from the nested data only when the caller did not pass them.
  - Nested sub-issues and label changes are appended after the caller's own, dropping exact duplicates.
  - A nested `FINISH_STATUS=failed` combined with the caller's `--status success` is a usage error.
  - Unknown lines in a merge block are ignored.
- Usage errors (missing or invalid flag, bad status, non-numeric id, unknown tag, repo with no origin) print nothing on stdout, an error on stderr, and exit `1`.

### `next_step_prompt.sh` (plain bash, not engine-dispatched)

```bash
arcanum/_lib/next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]...
```

- With one command it prompts `Next step: <cmd>` then `Run it now? [Y]es / [N]o / [C]hat: `. With several commands it prints `Next steps:` followed by one command per line, then the same question.
- The prompt text goes to `/dev/tty` (never stdout). Input is read from `/dev/tty` and is case-insensitive: `y|yes`, `n|no`, `c|chat`. Anything else re-prompts.
- stdout and exit codes:
  - `CHOICE=yes`, exit 0
  - `CHOICE=no`, exit 0
  - `CHOICE=chat` then `CHAT_CONTEXT=next_step`, exit **3**
  - usage error, `--repo` not a directory, or `/dev/tty` unreadable: nothing on stdout, error on stderr, exit 1

### Nesting handoff (skill-writer ↔ `auto-plan-issue`)

- `discuss-issue` runs `auto-plan-issue/steps/run.md` "carrying `REPO_PATH` forward unchanged, with `NESTED=true`".
- `auto-plan-issue` does not emit a `FINISH_*` block until #665. `discuss-issue` passes `--merge` only when the nested run actually returned one.

## Notes

- `docs/agents/specs/skill-finish.md` is authoritative. If this plan conflicts with it, the spec wins. The one deliberate addition is the `ssh.github.com` → `github.com` URL mapping, which the spec's "`https://<domain>/…`" wording did not anticipate.
- `docs/agents/architecture/entrypoint-migration-status.md` is auto-generated. Regenerate it with `scripts/generate_entrypoint_migration_status.sh` after flipping `finish-report` (owned by node).
- Order: scripter and node can work in parallel against the contracts above. skill-writer depends on both.
