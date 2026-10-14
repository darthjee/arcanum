# Plan: Enhance spec: command-surface.md

Issue: [770-enhance-spec-command-surface-md.md](../../issues/770-enhance-spec-command-surface-md.md)

## Overview

This is a docs-only change. It deepens `docs/agents/specs/arcanum-cli/command-surface.md` so that every open point it lists is resolved, and it records the delegations the index (`arcanum-cli.md`) points at it for. It then aligns the index and `shared-config-logic.md` with the new decisions. No code is written. The owner is `architect`.

## Context

`command-surface.md` currently leaves five open points: exit codes, `--json` shapes, error wording, behaviour with no repo or a malformed file, and lock contention. The index also says this file defines `--force`'s scope, the `--repo` normalization rule, the `info` JSON shape and the numbers of its two dedicated exit codes. None of these are written down yet.

The issue discussion settled the following:

- **Exit codes:**
  - `0` ok
  - `1` generic error, which also covers `get` on an unset key
  - `2` usage error
  - `3` validation error
  - `4` target unavailable
  - `5` version skew refused
  - `6` lock timeout
  - `7` malformed tier file or I/O error

  `--force` bypasses only `3` (unknown key) and `5`.
- **Malformed tier file** (invalid JSON, or JSON that is not an object): reads warn on stderr and treat that tier as empty. Writes are refused with `7`, and the file is never overwritten. This differs on purpose from `RepoConfigWriter._readBase` (`core/lib/utils/config/RepoConfigWriter.js`), which treats a malformed file as `{}`. The CLI pre-checks the target file before it calls the shared writer.
- **Lock contention:** writes wait for a bounded time, about 10s by default, set with `--lock-timeout <seconds>`. On timeout they exit `6`, naming the lock file and giving a stale-lock hint. Reads take no lock. This needs an optional max-attempts or timeout option on `core/lib/utils/file/Lock.js`, owned by `node`. Skills keep the current wait-forever default.
- **`--json`:** each command prints one stable object on stdout. Warnings and errors always go to stderr. `get` on an unset key prints `{"key", "set": false, "value": null, "source": null}` and exits `1`.

## Implementation Steps

### Step 1 — Rewrite `command-surface.md`

Expand `docs/agents/specs/arcanum-cli/command-surface.md`, keeping its current structure (Purpose / Decisions / Alternatives / Open points). Add or extend the following:

1. **Command syntax:** complete synopses for `get`, `set`, `unset`, `list` and `info`. Cover flag placement (global flags before or after the subcommand), mutually exclusive tier flags (more than one is exit `2`), `--all-tiers` combined with a tier flag (exit `2`), and `--` to end option parsing for values that start with `-`.
2. **Value parsing edge cases:**
   - the empty string;
   - `--string` combined with JSON-looking input;
   - input that looks like JSON but is invalid (e.g. `[1,`), which is stored as a string unless the registry type is array or object, in which case it is exit `3`;
   - numbers beyond safe-integer precision;
   - `null` versus `unset`;
   - how a parsed value is checked against the registry type.
3. **`--force` scope:** what it bypasses (unknown key → `3`, version skew → `5`) and what it never bypasses (`4`, `6`, `7`, read-only keys, usage errors). Decide and state whether read-only keys can be forced. The recommendation is **no**, since `version` and `migrations.version` belong to migrations.
4. **`--repo` normalization rule:** `git -C <path> rev-parse --show-toplevel`; the behaviour for a subdirectory, a worktree and a bare repo; reuse of the `RepoPath` messages for a non-existent path or a file. Cross-link the index's Targeting section rather than repeating its tables.
5. **Exit codes:** the numbered table above, with stable identifiers (e.g. `EXIT_TARGET_UNAVAILABLE`). It fills in the index's "version skew refused" (`5`) and "target unavailable" (`4`). Note that a Node.js below the floor exits `1`.
6. **Missing and malformed tier files:** a read/write table covering missing file, empty file, invalid JSON, non-object JSON (`null`, array, scalar) and unreadable file (permissions). Writes refuse with `7`, and the CLI pre-checks the file before calling the shared writer. State explicitly why the CLI diverges from `RepoConfigWriter._readBase`.
7. **Lock contention:** a bounded wait, the default timeout, `--lock-timeout <seconds>` (`0` means try once), and exit `6` with a message naming the lock file. Reads are lock-free. State the dependency on an optional bound in the shared `Lock`.
8. **Output and `--json` shapes:** human output examples, plus a JSON shape for each of these:
   - `get`, both with and without `--all-tiers`; the unset case exits `1`;
   - `set` and `unset`, giving the tier, the file, the previous value and the new value;
   - `list`, as an array of `{key, tier, value, known, description}`;
   - `info`, with the `cli`, `account` and `repo` blocks, and `repo: null` when there is no repo;
   - errors, as `{error: {code, exit, message}}`. In `--json` mode errors go to stderr, so stdout stays empty or holds only a valid object.
9. **Error message wording:** conventions such as the prefix `arcanum: `, one line, naming the key, tier and file, and a hint line where one helps. Give example messages for each exit code.
10. **Edge cases, backward compatibility, testing, performance and security:** add these sections, scoped to this file. Testing uses temp `CLAUDE_CONFIG_DIR`s and repos, one spec per exit code and per malformed-file kind, and lock-timeout specs that use a short `sleepMs`. Security covers no overwrite of malformed files, no shell interpolation, and no writes outside the resolved tier files.
11. **Open points:** remove the five points that are now resolved. Keep only what is genuinely still open, for example whether `list --json` includes registry defaults for unset keys.

### Step 2 — Align the index and sibling parts

- `docs/agents/specs/arcanum-cli.md`:
  - In "Exit codes", add the resolved numbers next to the two dedicated meanings, or keep it meaning-only and link to them. Make sure there is no contradiction, e.g. "generic error code" is now `1` and "usage" is `2`.
  - Add a row to the "Pieces introduced by this spec's decisions" table: *optional bounded wait (max attempts / timeout) on `core/lib/utils/file/Lock.js`, default unchanged for skills*, owned by `node`.
  - Check that the "Parts" bullet for Command Surface still matches what the file covers. Add lock-timeout and malformed-file handling to it.
- `docs/agents/specs/arcanum-cli/shared-config-logic.md`:
  - Link the "Lock interoperability" open point to the Command Surface lock-contention decision.
  - Note under "Guardrails" or "Open points" that `Lock` gains an optional bound and that the CLI does its malformed-file pre-check itself.
  - Note that the `ConfigError`→exit-code mapping now targets the codes defined in Command Surface.
- Check the other parts (`key-registry.md`, `shortcuts-and-setup.md`) for references to exit codes, `--force` or `--json` shapes that need a matching link. Edit them only where they would otherwise contradict the new text.

## Files to Change

- `docs/agents/specs/arcanum-cli/command-surface.md`: the main deepening (Step 1).
- `docs/agents/specs/arcanum-cli.md`: exit-code alignment, the new `Lock` row in the "Pieces introduced" table, and the Parts bullet (Step 2).
- `docs/agents/specs/arcanum-cli/shared-config-logic.md`: cross-links for lock and malformed-file handling, and the exit-code mapping target (Step 2).
- `docs/agents/specs/arcanum-cli/key-registry.md`, `docs/agents/specs/arcanum-cli/shortcuts-and-setup.md`: only if they contradict the new text (Step 2).

## Notes

- This is docs only. The `Lock` bounded-wait option and the CLI's malformed-file pre-check are implementation work for `node` and `client` in later issues of epic #767. This issue only specifies them.
- Write in the same terse, plain style as the existing spec files: short sentences, tables for case matrices, and no repetition of the index's Targeting and Version-skew tables (link to them instead).
- Sibling "Enhance spec" issues (#771–#774) may edit the same index lines in parallel. Keep the index edits minimal to reduce merge conflicts.
