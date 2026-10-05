# Plan: Auto-next: skill wiring

Issue: [715-auto-next-skill-wiring.md](../../issues/715-auto-next-skill-wiring.md)

## Overview
Wire `next_step_prompt.sh --auto-key` / `--no-prompt` (from #714) into every skill that makes a next-step offer, as described in `docs/agents/specs/skill-auto-next.md`. The work also includes the decisions made while refining #715. `has-label` gets a separate exit code for "could not check", so the Epic check fails safe. A new `auto-plan-issue/scripts/auto_next.sh` holds the top-level chain decision for `auto-plan-issue`: the branch check, the config read, and the plan push. Offers keyed on `auto-plan-issue` now use `/loop /auto-resolve-issue <id>`.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [skill-writer](skill-writer.md)
- [architect](architect.md)

## Shared contracts

### `auto-fix-all/scripts/github.sh has-label <repo_path> <id> <name>` (changed exit codes)

| Exit | Meaning |
| --- | --- |
| `0` | issue `<id>` has a label equal to `<name>` (case-insensitive, literal, whole name) |
| `1` | labels were fetched and none matches; **also** usage errors (missing args), unchanged |
| `2` | **new**: the labels could not be determined (gh user setup, repo ref resolution, or `gh issue view` failed) |

Output is unchanged (nothing on stdout). The shell path (`github_shell.sh cmd_has_label`) and the native path (`AutoFixAllGithub#hasLabel`, `DispatchFailure('', 2)` on a fetch error) must agree, and the parity spec pins this. Existing callers (`auto-fix-all`, `push-issue-to-queue`, `auto-resolve-issue`) treat any non-zero exit as "not an Epic" and stay unchanged.

### `auto-plan-issue/scripts/auto_next.sh <repo_path> <id>` (new, plain bash, not engine-dispatched, like `next_step_prompt.sh`)

Called by a **top-level** `auto-plan-issue` only, never with `NESTED=true`. It runs on both success exits ("plan written" and "plan already exists"), before the success report.

1. Usage error (missing args, `<repo_path>` not a directory): error on stderr, exit `1`, nothing on stdout.
2. If `git -C <repo_path> rev-parse --abbrev-ref HEAD` is not `issue-<id>`: print `CHAIN=no` and `REASON=branch`, then exit `0`. No config read.
3. Run `arcanum/_lib/next_step_prompt.sh --repo <repo_path> --command "/loop /auto-resolve-issue <id>" --auto-key auto-plan-issue --no-prompt`. Its stderr (the `auto-continuing: ...` notice) passes through to stderr. On `CHOICE=no`: print `CHAIN=no` and `REASON=config`, then exit `0`. If it fails (non-zero): error on stderr, exit `1`.
4. On `CHOICE=yes`, run `git -C <repo_path> push` with git's output sent to stderr. On failure: print `CHAIN=no` and `REASON=push`, then exit `0`. On success: print `CHAIN=yes`, then exit `0`.

stdout is only `key=value` lines: `CHAIN=yes|no`, plus `REASON=branch|config|push` when `CHAIN=no`.

### Offered commands and auto keys

| Offer site | `--command` | `--auto-key` |
| --- | --- | --- |
| `enhance-issue/steps/publish.md` | `/discuss-issue <id>` | `enhance-issue`, only when `has-label ... Epic` exits `1`; omitted on `0` or `2` |
| `discuss-issue/steps/discuss_and_save.md` §8, first offer | `/auto-plan-issue <id>` | `discuss-issue` |
| `discuss-issue/steps/discuss_and_save.md` §8, second offer | `/loop /auto-resolve-issue <id>` | `auto-plan-issue` |
| `plan-issue/steps/write_and_confirm.md` | `/loop /auto-resolve-issue <id>` | `auto-plan-issue` |
| `auto-plan-issue/steps/run.md` (top level) | `--next "/loop /auto-resolve-issue <id>"`; chains via `auto_next.sh` | `auto-plan-issue` (inside `auto_next.sh`) |

A `CHOICE=yes` with `AUTO=true` is handled like a user's `[Y]es`. The skill relays the stderr notice line to the user, then runs the command as a chained top-level run (no `NESTED=true`). A `/loop /auto-resolve-issue <id>` command runs through the `loop` skill (`Skill(loop, "/auto-resolve-issue <id>")`).

## Notes
- The `next_step.auto.*` keys default to `false`, so nothing changes when they are not set.
- Order of work: scripter's and node's work (the contracts) comes before skill-writer, which calls them. architect's doc changes can run in parallel.
- CI: `make core-check` (`yarn lint` + `yarn test` in `core/`), and `scripts/check_tags_table.sh`, which this issue does not affect.
