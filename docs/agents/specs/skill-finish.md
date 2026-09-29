# Spec: Skill Finish

## Status

Proposed. Nothing in this spec is implemented yet. It is tracked by:

- #658, the parent issue (standardize how skills finish);
- #660–#667, one sub-issue per in-scope skill, each implementing its own ending against this spec;
- #668, which removes this spec once #660–#667 are done and moves the lasting rules into `docs/agents/architecture/`.

## Goal

Every in-scope issue skill ends the same way:

1. a fixed **closing report**, rendered by a shared script;
2. then the **next step**: an offer on `/dev/tty` for interactive skills, or a `Next:` line for auto skills.

In scope:

| Skill | Kind |
| --- | --- |
| `discuss-issue` | interactive |
| `enhance-issue` | interactive |
| `plan-issue` | interactive |
| `arcanum-split-issue` | interactive |
| `auto-new-issue` | auto |
| `auto-plan-issue` | auto |
| `auto-fix-issue` | auto |
| `auto-rewrite-issue` | auto |

Out of scope: `auto-fix-all`, `auto-monitor-issue-pr`, `auto-monitor-pr`, `monitor-issues`, `push-issue-to-queue`, `arcanum-migrate`, `arcanum-update`, `init-claude`, and the `toggle-*` skills. `auto-fix-all` keeps its own `OUTCOME=...` protocol toward its coordinator. It is affected only as a **nested caller** (see [Nested runs](#nested-runs)).

## Closing report

The report is always printed by `arcanum/_lib/finish_report.sh`. Skills never hand-format it, never add lines to it, and never paraphrase it. They relay its stdout verbatim as the last thing they print (before the next-step offer, for interactive skills).

### Format

```text
== <skill>: <STATUS> ==
<summary>
Issue: #<id> <issue url>
PR: #<n> <pr url>
Sub-issues: #<a> #<b> ...
Labels: <Before> -> <After>
Next: <command>
```

Line rules:

- The header line is always present. `<STATUS>` is the upper-cased `--status` value: `SUCCESS`, `DECLINED` or `FAILED`.
- The summary line is always present: the `--summary` text, one line, trimmed.
- `Issue:`, `PR:` and `Sub-issues:` are printed only when the matching flag was given, in that order.
- `Labels:` is printed once per `--label-change`, in the order given. An added label prints as `(none) -> <After>`, a removed one as `<Before> -> (none)`.
- `Next:` is printed once per `--next`, in the order given. Only auto skills pass `--next` (see [Auto skills](#auto-skills)).
- No blank lines inside the block. No trailing text.

### Exit paths

Every exit path of an in-scope skill ends with the report, including early exits:

- **success**: the skill did its job. `--status success`, with the links and label changes it produced.
- **declined**: the user stopped the flow on purpose, e.g. rejected a draft. `--status declined`. Links and label changes are only those that actually happened before the decline. No next-step offer and no `Next:` line.
- **failed**: a script or step failed and the skill cannot continue. `--status failed`, with the summary naming the failed step. No next-step offer and no `Next:` line.

A skill that exits on a `[C]hat` hand-off (from the next-step offer or any other `/dev/tty` prompt) does not print a second report: the report was already printed before the prompt.

### Example

```text
== plan-issue: SUCCESS ==
Plan written and committed for issue #123.
Issue: #123 https://github.com/darthjee/arcanum/issues/123
Labels: Refined -> Ready
```

followed, for this interactive skill, by the next-step offer for `/auto-fix-issue 123`.

## Report script interface

```bash
arcanum/_lib/finish_report.sh <repo_path> --skill <name> --status success|declined|failed --summary "<text>" \
  [--issue <id>] [--pr <number>] [--sub-issue <id>]... \
  [--label-change <before_tag>:<after_tag>]... \
  [--next "<command>"]... \
  [--merge "<nested result>"]... \
  [--nested]
```

- `<repo_path>`: required first positional argument, per [Repo Path Threading](../architecture/repo-path-threading.md). Used to resolve the GitHub domain and owner/repo (`arcanum/_lib/origin.sh`) to build the issue and PR URLs. No network call is made.
- `--skill`: the skill name as printed in the header, e.g. `plan-issue`.
- `--status`: one of `success`, `declined`, `failed`. Anything else is a usage error.
- `--summary`: one line of free text. The only non-deterministic input; everything else is structured.
- `--issue`, `--pr`, `--sub-issue`: numeric ids. The script builds `https://<domain>/<owner>/<repo>/issues/<id>` and `.../pull/<n>`.
- `--label-change <before_tag>:<after_tag>`: canonical tag names from [Issue Tags](../architecture/issue-tags.md), mapped to GitHub label names through `arcanum/_lib/tags.sh`. Either side may be empty (`:working` for an add, `fetched:` for a remove), but not both.
- `--next`: the exact command for the next step, e.g. `/auto-fix-issue 123`. Repeatable, for skills with one next step per sub-issue.
- `--merge`: the full stdout of a nested run's `--nested` call (see [Nested runs](#nested-runs)), passed as one argument. Repeatable, one per nested run.
- `--nested`: print the result-data block instead of the report.

Output and exit codes:

| Case | stdout | Exit |
| --- | --- | --- |
| report rendered | the report block | `0` |
| `--nested` | the result-data block | `0` |
| usage error (missing or invalid flag, unknown tag) | nothing; error on stderr | `1` |

### Engine

`finish_report.sh` follows the shim pattern from [Script Engine](../architecture/script-engine.md): `finish_report.sh` → `engine_dispatch.sh` → `finish_report_shell.sh`, or the native `core/bin/arcanum finish-report` command. Both implementations ship together, with a shell-vs-native parity spec, and `finish-report` is added to `arcanum/_lib/migration-status.json` as `true` from day one. This keeps the new entrypoint off the backlog that blocks [Shell Engine Removal](shell-engine-removal.md). The script is pure formatting plus local git-origin parsing, so parity is cheap.

## Next-step offer (interactive skills)

After relaying the report, an interactive skill whose status is `success` runs:

```bash
arcanum/_lib/next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]...
```

It follows the `arcanum-migrate` convention in [Per-Repo Migrations](../architecture/per-repo-migrations.md): it owns the prompt on `/dev/tty`, never a chat-mediated yes/no.

### Prompt

The prompt always shows the exact command(s), so the user can decline and run them by hand later:

```text
Next step: /auto-fix-issue 123
Run it now? [Y]es / [N]o / [C]hat:
```

With more than one `--command`, each is listed on its own line under `Next steps:`, and `[Y]es` means run all of them, in the order listed.

Input is case-insensitive; `y`/`yes`, `n`/`no`, `c`/`chat` are accepted. Anything else re-prompts.

### Output protocol

| Choice | stdout | Exit |
| --- | --- | --- |
| `[Y]es` | `CHOICE=yes` | `0` |
| `[N]o` | `CHOICE=no` | `0` |
| `[C]hat` | `CHOICE=chat` then `CHAT_CONTEXT=next_step` | `3` |
| usage error, bad `--repo`, or `/dev/tty` not readable | nothing; error on stderr | `1` |

Exit `3` mirrors the migrations runner's `[C]hat` hand-off.

### Skill-side rules

- **`CHOICE=yes`**: invoke the next skill inline, in the same session, the way `plan-issue` runs `auto-fix-issue` today. This is a **chained** run, not a nested one: the next skill runs as a top-level skill and prints its own report and next step.
- **`CHOICE=no`**: end. The report is already printed, and its command is the user's manual path.
- **`CHOICE=chat`** (exit `3`): return to the conversation. Do not run the next step unless the user asks for it in chat.
- **Exit `1`**: treat as `no`, and tell the user in one line that the prompt was unavailable.

The skill never re-asks in chat and never changes the command that was shown.

## Auto skills

Auto skills never prompt. On `success` they pass the next command(s) as `--next`, so their report ends with `Next: <command>`. On `declined` or `failed` they pass no `--next`.

## Nested runs

A run is **nested** when another skill executes it as a step of its own flow, reading its `steps/run.md` directly. Examples:

- `auto-fix-all/steps/process_one_issue.md` runs `auto-new-issue`, `auto-plan-issue` and `auto-fix-issue`;
- `discuss-issue/steps/discuss_and_save.md` §8 runs `auto-plan-issue`.

Only the outermost skill prints a report.

### How a skill knows it is nested

Explicitly, never inferred from the environment, the branch or the presence of other state. The caller says so when it hands over, the same way it already threads `REPO_PATH`: its step reads "follow `<skill>/steps/run.md` for `<id>`, carrying `REPO_PATH` forward unchanged, with `NESTED=true`". Absence of `NESTED=true` means top level. A nested run passes `NESTED=true` on to any run it nests in turn.

A chained run (next-step offer accepted) is never nested.

### What a nested run hands back

The nested run calls `finish_report.sh` with the same flags it would use at top level (minus `--next`), plus `--nested`. Instead of the report, the script prints the result data:

```text
FINISH_SKILL=<skill>
FINISH_STATUS=success|declined|failed
FINISH_SUMMARY=<summary>
FINISH_ISSUE=<id>
FINISH_PR=<n>
FINISH_SUB_ISSUE=<id>
FINISH_LABEL_CHANGE=<before_tag>:<after_tag>
```

- `FINISH_SKILL`, `FINISH_STATUS` and `FINISH_SUMMARY` are always present, in that order.
- The other keys appear only when set. `FINISH_SUB_ISSUE` and `FINISH_LABEL_CHANGE` repeat, once per value, in the order given.

The nested run ends its turn by relaying exactly this block to its caller, with no report and no `Next:` line.

### How the outermost skill merges it

The outermost skill passes each nested block to its own `finish_report.sh` call as a `--merge "<block>"` argument. The script then:

- keeps the caller's own `--skill`, `--status` and `--summary`;
- fills `Issue:` and `PR:` from the nested data only when the caller did not pass them;
- appends nested sub-issues and label changes after the caller's own, dropping exact duplicates;
- if a nested `FINISH_STATUS` is `failed`, and the caller passed `success`, it is a usage error (exit `1`): the caller must report the failure itself.

`auto-fix-all` is the exception: it is out of scope and keeps reporting `OUTCOME=...` to its coordinator. It still passes `NESTED=true`, so its nested runs stay silent.

## Next-step map

| Skill | Next command(s) | Delivery |
| --- | --- | --- |
| `enhance-issue` | `/discuss-issue <id>` | offer |
| `discuss-issue` | `/auto-plan-issue <id>`, run nested; then `/auto-fix-issue <id>` | offer (twice, see below) |
| `plan-issue` | `/auto-fix-issue <id>` | offer |
| `arcanum-split-issue` | `/enhance-issue <sub-id>`, one per sub-issue | offer (all in one prompt) |
| `auto-new-issue` | `/auto-plan-issue <id>` | `Next:` |
| `auto-plan-issue` | `/auto-fix-issue <id>` | `Next:` |
| `auto-fix-issue` | `/auto-monitor-issue-pr <id>` | `Next:` |
| `auto-rewrite-issue` | `/discuss-issue <id>`, one per rewritten issue | `Next:` |

Notes:

- **`discuss-issue`** keeps its current two-phase ending. After pushing the issue, it offers `/auto-plan-issue <id>`. On yes, it runs `auto-plan-issue` **nested** (it still owns the push and the `Refined` → `Ready` swap afterwards), then prints one merged report and offers `/auto-fix-issue <id>`. On no, it prints its report with no second offer.
- **`arcanum-split-issue`** always points at `/enhance-issue`, not `/discuss-issue`: split sub-issues start as drafts, and `enhance-issue` then offers `/discuss-issue` itself. A user who wants to skip enhancing declines and runs `/discuss-issue <sub-id>` by hand.
- **`auto-rewrite-issue`** lists one `Next:` line per issue it rewrote.

## Implementation order and ownership

1. **Shared scripts first**, delivered with the first sub-issue implemented (#660), before any skill uses them:
   - `scripter` builds `arcanum/_lib/finish_report.sh`, `arcanum/_lib/finish_report_shell.sh` and `arcanum/_lib/next_step_prompt.sh`;
   - `node` builds the native `finish-report` command in `core/lib/` and its parity spec, and flips `finish-report` to `true` in `migration-status.json`.
   - `next_step_prompt.sh` is `/dev/tty`-interactive, like `arcanum/migrations/run.sh`, and stays a plain bash script outside the engine dispatch.
2. **Per-skill endings**: `skill-writer` changes each skill's final step in #660–#667, calling the scripts above with the interfaces defined here. Nested callers (`auto-fix-all/steps/process_one_issue.md`, `discuss-issue/steps/discuss_and_save.md`) add `NESTED=true` in the same sub-issue as the nested skill they call.
3. **Cleanup**: #668 removes this spec and moves the lasting rules (report format, prompt protocol, nesting rule) into `docs/agents/architecture/`. `architect` owns this spec and that move.

## See also

- [Script Preference](../architecture/script-preference.md): why the report is a script, not prose.
- [Per-Repo Migrations](../architecture/per-repo-migrations.md): the `/dev/tty` `[Y]es`/`[N]o`/`[C]hat` convention and exit-`3` hand-off.
- [Script Engine](../architecture/script-engine.md): the shim → `engine_dispatch.sh` → shell/native pattern.
- [Repo Path Threading](../architecture/repo-path-threading.md): the explicit `repo_path` argument.
- [Issue Tags](../architecture/issue-tags.md): canonical tags and their GitHub labels.
