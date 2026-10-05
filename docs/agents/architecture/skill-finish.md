# Skill Finish

Every in-scope issue skill ends the same way:

1. a fixed **closing report**, rendered by a shared script;
2. then the **next step**: an offer on `/dev/tty` for interactive skills (falling back to a structured `AskUserQuestion` when no TTY is available), or a `Next:` line for auto skills.

## Scope

| Skill | Kind |
| --- | --- |
| `discuss-issue` | interactive |
| `enhance-issue` | interactive |
| `plan-issue` | interactive |
| `arcanum-split-issue` | interactive |
| `arcanum-create-issue` | interactive |
| `auto-new-issue` | auto |
| `auto-plan-issue` | auto |
| `auto-fix-issue` | auto |
| `auto-rewrite-issue` | auto |
| `auto-resolve-issue` | auto |

Out of scope: `auto-fix-all`, `auto-monitor-issue-pr`, `auto-monitor-pr`, `monitor-issues`, `push-issue-to-queue`, `arcanum-migrate`, `arcanum-update`, `arcanum-check-config` (a read-only, single-shot query), `init-claude`, and the `toggle-*` skills. `auto-fix-all` keeps its own `OUTCOME=...` protocol toward its coordinator. It takes part only as a **nested caller** (see [Nested runs](#nested-runs)).

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
- `Issue:`, `PR:` and `Sub-issues:` are printed only when the matching value is set (by flag or by `--merge`), in that order.
- `Labels:` is printed once per label change, in the order given. Labels are shown as GitHub label names. An added label prints as `(none) -> <After>`, a removed one as `<Before> -> (none)`.
- `Next:` is printed once per `--next`, in the order given. Only auto skills pass `--next` (see [Auto skills](#auto-skills)).
- No blank lines inside the block. No trailing text.

### Exit paths

Every exit path of an in-scope skill ends with the report, including early exits:

- **success**: the skill did its job. `--status success`, with the links and label changes it produced.
- **declined**: the user stopped the flow on purpose, e.g. rejected a draft. `--status declined`. Links and label changes are only those that actually happened before the decline. No next-step offer and no `Next:` line. Auto skills never ask the user anything, so they never report `declined`.
- **failed**: a script or step failed and the skill cannot continue. `--status failed`, with the summary naming the failed step. No next-step offer and no `Next:` line.

A skill that exits on a `[C]hat` hand-off (from the next-step offer or any other `/dev/tty` prompt) does not print a second report.

### Example

```text
== plan-issue: SUCCESS ==
Plan written and committed for issue #123.
Issue: #123 https://github.com/darthjee/arcanum/issues/123
Labels: Refined -> Ready
```

followed, for this interactive skill, by the next-step offer for `/auto-resolve-issue 123`.

## Report script interface

```bash
arcanum/_lib/finish_report.sh <repo_path> --skill <name> --status success|declined|failed --summary "<text>" \
  [--issue <id>] [--pr <number>] [--sub-issue <id>]... \
  [--label-change <before_tag>:<after_tag>]... \
  [--next "<command>"]... \
  [--merge "<nested result>"]... \
  [--nested]
```

- `<repo_path>`: required first positional argument, per [Repo Path Threading](repo-path-threading.md). Used to resolve the GitHub domain and owner/repo (`arcanum/_lib/origin.sh`) to build the issue and PR URLs. The origin is read only when an `Issue:` or `PR:` line has to be printed, and no network call is made. The web domain is the origin domain, except `ssh.github.com`, which maps to `github.com`.
- Flags may appear in any order after `<repo_path>`. Repeatable flags keep their order. A repeated single-value flag (`--skill`, `--status`, `--summary`, `--issue`, `--pr`) keeps its last value.
- `--skill`: the skill name as printed in the header, e.g. `plan-issue`.
- `--status`: one of `success`, `declined`, `failed`. Anything else is a usage error.
- `--summary`: one line of free text, trimmed; empty or multi-line is a usage error. The only non-deterministic input; everything else is structured.
- `--issue`, `--pr`, `--sub-issue`: numeric ids. The script builds `https://<domain>/<owner>/<repo>/issues/<id>` and `.../pull/<n>`.
- `--label-change <before_tag>:<after_tag>`: canonical tag names from [Issue Tags](issue-tags.md), mapped to GitHub label names through `arcanum/_lib/tags.sh`. Either side may be empty (`:working` for an add, `fetched:` for a remove), but not both.
- `--next`: the exact command for the next step, e.g. `/auto-fix-issue 123`. Repeatable, for skills with one next step per issue.
- `--merge`: the full stdout of a nested run's `--nested` call (see [Nested runs](#nested-runs)), passed as one argument. Repeatable, one per nested run.
- `--nested`: print the result-data block instead of the report.

Output and exit codes:

| Case | stdout | Exit |
| --- | --- | --- |
| report rendered | the report block | `0` |
| `--nested` | the result-data block | `0` |
| usage error (missing or invalid flag, bad status, non-numeric id, unknown tag, repo with no origin, failed nested block merged into `success`) | nothing; error on stderr | `1` |

### Engine

`finish_report.sh` follows the shim pattern from [Script Engine](script-engine.md): `finish_report.sh` → `engine_dispatch.sh` → `finish_report_shell.sh`, or the native `core/bin/arcanum finish-report` command (`core/lib/commands/shared/FinishReport.js`). Both implementations ship together with a shell-vs-native parity spec, and `finish-report` is `true` in `arcanum/_lib/migration-status.json`, so it adds nothing to the backlog that blocks [Shell Engine Removal](../specs/shell-engine-removal.md). The script is pure formatting plus local git-origin parsing, with no `gh`/GitHub API dependency, so the shim forwards no env vars to the native path.

## Next-step offer (interactive skills)

After relaying a `success` report, an interactive skill runs:

```bash
arcanum/_lib/next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... [--auto-key <skill>] [--no-prompt]
```

It follows the "TTY-first with `AskUserQuestion` fallback" convention in [Per-Repo Migrations](per-repo-migrations.md#script-driven-interaction): it owns the prompt on `/dev/tty` whenever a terminal is available. When `/dev/tty` cannot be opened (as in some agent-driven sessions, where the Bash tool has no controlling terminal), it does not fail: it exits `4` with `FALLBACK=chat`, and the skill asks the same question through `AskUserQuestion`. Free-text chat yes/no stays forbidden. It is a plain bash script, not engine-dispatched, like `arcanum/migrations/run.sh`.

### Auto-next

Two optional flags let a next-step offer be skipped from config:

- **`--auto-key <skill>`** reads `next_step.auto.<skill>` through `config_chain_read <repo_path> next_step auto.<skill>` (`arcanum/_lib/config_chain.sh`: local state, then repo config, then global config; see [Shared State & Configuration Files](shared-state-and-configuration.md#the-next_step-namespace)). `config_chain_read` prints compact JSON, so only the JSON boolean `true` enables it. Absent, `null`, `false`, the string `"true"`, or any other value counts as disabled.
  - **Enabled**: the script prints `auto-continuing: <cmd> (next_step.auto.<skill>=true)` on **stderr** (`<cmd>` is the first `--command`, verbatim), then `CHOICE=yes` and `AUTO=true` on stdout, and exits `0`. `/dev/tty` is never probed.
  - **Disabled**: behavior is unchanged (the TTY prompt, or the exit-`4` `FALLBACK=chat` path).
- **`--no-prompt`** never prompts and never probes `/dev/tty`. It is meant for auto skills, which must never block on a prompt. With `--auto-key` and the key enabled, the output is the same as `--auto-key` alone (notice, `CHOICE=yes`, `AUTO=true`). Otherwise (key disabled, or no `--auto-key`), it prints `CHOICE=no` and exits `0`.

Argument validation still runs first: a usage error exits `1` before any config read or TTY probe. The notice goes to stderr so stdout keeps its key=value protocol, and `AUTO=true` is the only new stdout line, always right after `CHOICE=yes`.

The flags only take effect once a skill passes them: wiring `--auto-key` into the skills that make next-step offers is tracked by #715, so until then every offer still prompts.

### Prompt

The prompt is written to `/dev/tty` (never stdout) and always shows the exact command(s), so the user can decline and run them by hand later:

```text
Next step: /auto-fix-issue 123
Run it now? [Y]es / [N]o / [C]hat:
```

With more than one `--command`, each is listed on its own indented line under `Next steps:`, and `[Y]es` means run all of them, in the order listed.

Input is read from `/dev/tty`, case-insensitive; `y`/`yes`, `n`/`no`, `c`/`chat` are accepted. Anything else re-prompts.

### Output protocol

| Choice | stdout | Exit |
| --- | --- | --- |
| `[Y]es` | `CHOICE=yes` | `0` |
| `--auto-key` key enabled (with or without `--no-prompt`) | `CHOICE=yes` then `AUTO=true`; notice on stderr | `0` |
| `--no-prompt`, key disabled or no `--auto-key` | `CHOICE=no` | `0` |
| `[N]o` | `CHOICE=no` | `0` |
| `[C]hat` | `CHOICE=chat` then `CHAT_CONTEXT=next_step` | `3` |
| `/dev/tty` cannot be opened | `FALLBACK=chat`, then one `COMMAND=<cmd>` line per `--command`, in the order given (verbatim) | `4` |
| usage error (missing `--repo`, empty or missing `--command`, empty or missing `--auto-key` value, unknown argument), `--repo` not a directory, or `/dev/tty` closed/EOF before a valid answer | nothing; error on stderr | `1` |

Exit `3` mirrors the migrations runner's `[C]hat` hand-off. Argument validation runs before any config read and before the TTY probe, so a usage error exits `1` even when no TTY is available — a real error is never turned into a chat question.

The TTY device is overridable through `ARCANUM_TTY_DEVICE` (default `/dev/tty`). This is **test-only** — specs point it at a missing path to simulate "no TTY" — and not a user-facing setting.

### Skill-side rules

- **`CHOICE=yes`**: invoke the next skill inline, in the same session. This is a **chained** run, not a nested one: the next skill runs as a top-level skill (no `NESTED=true`) and prints its own report and next step.
- **`CHOICE=yes` with `AUTO=true`**: handled exactly like `[Y]es` (a chained run). The skill relays the stderr notice line to the user, so the automatic hop is visible.
- **`CHOICE=no`**: end. The report is already printed, and its command is the user's manual path.
- **`CHOICE=chat`** (exit `3`): return to the conversation. Do not run the next step unless the user asks for it in chat.
- **`FALLBACK=chat`** (exit `4`): no TTY was available. Ask with `AskUserQuestion`, naming the exact command(s) from the `COMMAND=` lines, with the options **Yes** (run it now; with several commands, run all of them in order), **No**, and **Chat**. Map the answer onto the branches above: Yes → `CHOICE=yes`, No → `CHOICE=no`, Chat → `CHOICE=chat`. A free-text "Other" answer is treated as Chat, with the text as context. A dismissed or rejected question is treated as No. If `AskUserQuestion` is unavailable (e.g. headless `claude -p`, or the tool is denied), print "Next step: `<cmd>` (run it manually)" and end.
- **Exit `1`**: treat as `no`, and tell the user in one line that the next-step prompt failed, quoting its stderr.

Apart from the exit-`4` `AskUserQuestion` fallback, the skill never re-asks in chat, and it never changes the command that was shown.

## Auto skills

Auto skills never prompt. On `success` they pass the next command(s) as `--next`, so their report ends with `Next: <command>`. On `declined` or `failed` they pass no `--next`. When invoked through a slash command, the skill's `SKILL.md` relays the architect's closing report to the user verbatim.

## Nested runs

A run is **nested** when another skill executes it as a step of its own flow, reading its `steps/run.md` directly. Current nested callers:

- `auto-resolve-issue/steps/process_one_issue.md` (run by `auto-resolve-issue`, and by `auto-fix-all` for each queued issue) runs `auto-new-issue`, `auto-plan-issue` and `auto-fix-issue`;
- `discuss-issue/steps/discuss_and_save.md` §8 runs `auto-plan-issue`.

Only the outermost skill prints a report.

### How a skill knows it is nested

Explicitly, never inferred from the environment, the branch or the presence of other state. The caller says so when it hands over, the same way it threads `REPO_PATH`: its step reads "follow `<skill>/steps/run.md` for `<id>`, carrying `REPO_PATH` forward unchanged, with `NESTED=true`". Absence of `NESTED=true` means top level. A nested run passes `NESTED=true` on to any run it nests in turn.

A chained run (next-step offer accepted) is never nested.

### What a nested run hands back

The nested run calls `finish_report.sh` on every exit path with the same flags it would use at top level, minus `--next`, plus `--nested`. Instead of the report, the script prints the result data:

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
- The other keys appear only when set. `FINISH_SUB_ISSUE` and `FINISH_LABEL_CHANGE` repeat, once per value, in the order given. Label changes stay canonical tags, not GitHub label names.
- `--next` is ignored with `--nested`.

The nested run ends its turn by relaying exactly this block to its caller, with no report and no `Next:` line.

### How the outermost skill merges it

The outermost skill passes each nested block to its own `finish_report.sh` call as a `--merge "<block>"` argument. The script then:

- keeps the caller's own `--skill`, `--status` and `--summary`;
- fills `Issue:` and `PR:` from the nested data only when the caller did not pass them;
- appends nested sub-issues and label changes after the caller's own, dropping exact duplicates;
- ignores unknown lines in the block (and validates the known ones as it would the matching flags);
- if a nested `FINISH_STATUS` is `failed` and the caller passed `success`, it is a usage error (exit `1`): the caller must report the failure itself.

`discuss-issue` goes further: a nested `auto-plan-issue` block with `FINISH_STATUS=failed` or `declined` makes `discuss-issue` report its own `failed` status, and it never merges such a block.

`auto-fix-all` is the exception: it is out of scope and keeps reporting `OUTCOME=...` to its coordinator. It still passes `NESTED=true`, so its nested runs stay silent. It never relays or merges their blocks; it only reads them, e.g. `FINISH_STATUS=failed` becomes `OUTCOME=blocked AGENT=architect ACTION="<FINISH_SUMMARY>"`, and `FINISH_PR` gives it the PR number opened by `auto-fix-issue`.

## Next-step map

| Skill | Next command(s) | Delivery |
| --- | --- | --- |
| `enhance-issue` | `/discuss-issue <id>` | offer |
| `discuss-issue` | `/auto-plan-issue <id>`, run nested; then `/auto-resolve-issue <id>` | offer (twice, see below) |
| `plan-issue` | `/auto-resolve-issue <id>` | offer |
| `arcanum-split-issue` | `/enhance-issue <sub-id>`, one per sub-issue created in this run | offer (all in one prompt) |
| `arcanum-create-issue` | `/arcanum-split-issue <id>` when the issue was created as an `Epic` (`EPIC=true`), otherwise `/discuss-issue <id>` | offer |
| `auto-new-issue` | `/auto-plan-issue <id>` | `Next:` |
| `auto-plan-issue` | `/auto-resolve-issue <id>` | `Next:` |
| `auto-fix-issue` | `/auto-monitor-issue-pr <id>` | `Next:` |
| `auto-rewrite-issue` | `/discuss-issue <id>`, one per rewritten issue | `Next:` |
| `auto-resolve-issue` | none | - |

Notes:

- **`discuss-issue`** has a two-phase ending. After pushing the issue, it offers `/auto-plan-issue <id>` **before** printing any report, since the report depends on the answer. On yes, it runs `auto-plan-issue` **nested** (it still owns the plan push and the `Refined` → `Ready` swap afterwards), then prints one merged report and offers `/auto-resolve-issue <id>`. On no, chat, or an unavailable prompt, it prints its push-only report with no second offer.
- **`arcanum-split-issue`** always points at `/enhance-issue`, not `/discuss-issue`: split sub-issues start as drafts, and `enhance-issue` then offers `/discuss-issue` itself. On yes, each `/enhance-issue` runs as a chained run, one after the other, each with its own report and offer. Before its success report, the skill's own `scripts/finish.sh` (the `arcanum-split-issue-finish` migrated entrypoint) relabels the parent `Planning` → `Split`, deletes the local working files and releases the working tree; the report's `planning:split` label change is passed only once it has run.
- **`arcanum-create-issue`** picks its single next command from the `EPIC=` key printed by `scripts/publish.sh`: an Epic goes to `/arcanum-split-issue`, any other issue to `/discuss-issue`. The applied labels are named in the `success` summary rather than passed as `--label-change` (which only accepts canonical pipeline tags), and the summary says so when `shipit` was asked for but not confirmed. A `declined` report (the user abandoned the run) names the kept draft path. Answering **Chat** at the final confirmation is not an exit: the run stays open, with the draft kept and no report yet, so the user can keep refining and publish later in the same run.
- **`auto-resolve-issue`** ends with `success` once the PR is merged, `declined` for an Epic or when the user stops after a closed PR or a blocked dispatch, and `failed` when no id was given. It passes no `--next`: a merged PR is the end of the pipeline. Its `pending` reschedule via `ScheduleWakeup` is not an exit and prints no report. Like `auto-fix-all`, it reads the spawned architect's `OUTCOME=...` rather than merging nested `FINISH_*` blocks.
- **`auto-rewrite-issue`** processes a queue: it lists one `Next:` line per issue it rewrote, reports `success` if at least one id was rewritten (naming failed ids in the summary), `success` with no `Next:` on an empty queue, and `failed` if ids were popped but none was rewritten.

## See also

- [Script Preference](script-preference.md): why the report is a script, not prose.
- [Per-Repo Migrations](per-repo-migrations.md): the `/dev/tty` `[Y]es`/`[N]o`/`[C]hat` convention and exit-`3` hand-off.
- [Script Engine](script-engine.md): the shim → `engine_dispatch.sh` → shell/native pattern, and its native-only variant (`engine_dispatch --native-only`, no shell side) used by new skills.
- [Repo Path Threading](repo-path-threading.md): the explicit `repo_path` argument.
- [Issue Tags](issue-tags.md): canonical tags and their GitHub labels.
- [Cross-Skill References](cross-skill-references.md): how a caller reads another skill's `steps/run.md` directly.
