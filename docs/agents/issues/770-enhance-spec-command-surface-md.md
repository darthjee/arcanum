# Issue: Enhance spec: command-surface.md

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). Deepen and review `docs/agents/specs/arcanum-cli/command-surface.md`, written in #768 and indexed by `docs/agents/specs/arcanum-cli.md` (enhanced in #769).

Focus: exact syntax of every `arcanum config` command, value parsing rules, error messages and exit codes, `--json` output shape, behaviour outside a git repo / with missing or malformed config files, and lock contention.

Owner: `architect`. Docs only — no code. Runs after #768; can run in parallel with the other "Enhance spec" sub-issues.

## Problem

`command-surface.md` lists the commands and flags but leaves five open points that the index (`arcanum-cli.md`) explicitly delegates to it:

- exact exit codes, including the numbers for the index's "version skew refused" and "target unavailable";
- the `--json` output shape of each command, including `info`'s `cli`/`account`/`repo` object;
- error message wording;
- behaviour outside a git repo and with a missing or malformed tier file;
- behaviour on lock contention.

It also never states `--force`'s scope or the `--repo` normalization rule, though the index points here for both. Two existing code facts make some of these non-trivial:

- `RepoConfigWriter._readBase` treats a malformed (unparseable) file as `{}`, so a naive write would silently overwrite a corrupted user file.
- `Lock.acquire` never gives up (it warns once after 10 attempts and retries forever), which suits skills but not an interactive CLI command.

## Expected Behavior

`command-surface.md` resolves all its open points and is consistent with the index:

- full syntax for `get`/`set`/`unset`/`list`/`info`, global flags, `--force`, `--string`, `--all-tiers`, `--help`/`--version`;
- value parsing rules with edge cases (empty string, quoted JSON, invalid JSON-looking input, large numbers);
- a numbered exit-code table, including "version skew refused" and "target unavailable";
- the `--json` shape of every command, and where warnings go (stderr) in JSON mode;
- error message wording conventions;
- missing / malformed / non-object tier-file behaviour for reads and writes;
- lock-contention behaviour;
- the `--repo` normalization rule and `--force`'s scope;
- edge cases, backward compatibility, testing strategy, performance and security sections.

Cross-links with the index and the other parts stay consistent, and the open-points list is updated.

## Solution

Edit `docs/agents/specs/arcanum-cli/command-surface.md`, and the index (`arcanum-cli.md`) only where its wording must align. Decisions taken during discussion:

**Exit codes** (small dedicated set):

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic error; also `get` on an unset key, like `git config` |
| 2 | Usage error |
| 3 | Validation error (key registry, type, enum, tier, read-only) |
| 4 | Target unavailable |
| 5 | Version skew refused |
| 6 | Lock timeout |
| 7 | Malformed tier file / I/O error |

A Node.js below the floor exits 1. `--force` bypasses only 3 (unknown key) and 5. It never bypasses 4, 6 or 7.

**Malformed tier file** (invalid JSON, or valid JSON that is not an object):

- Reads warn on stderr and treat that tier as empty, so `get`/`list` keep working for the other tiers.
- Writes to that tier are refused with code 7. The file is never overwritten, unlike `RepoConfigWriter._readBase`, which treats it as `{}`. The CLI checks the target file before calling the shared writer.
- `--force` does not bypass this.

**Lock contention:**

- Writes use the shared `Lock` with a **bounded wait**, about 10s by default and configurable with `--lock-timeout <seconds>`.
- On timeout the CLI exits 6, naming the lock file and how to remove a stale lock.
- This needs an optional max-attempts or timeout parameter on `core/lib/utils/file/Lock.js`, with skills keeping the current wait-forever default. That is a `node` change. Record it in the index's "Pieces introduced" table and cross-link [Shared Config Logic](shared-config-logic.md)'s lock-interop open point.
- Reads take no lock.

**`--json`:**

- Each command prints one stable object on stdout. Warnings and errors always go to stderr, also in JSON mode.
- `get` on an unset key prints `{"key": …, "set": false, "value": null, "source": null}` and exits 1.
- The spec defines the shapes of `get` (including `--all-tiers`), `set`/`unset` (the written tier, file, and previous and new value), `list`, `info` (the `cli`/`account`/`repo` blocks; `repo` is `null` with no repo) and the error object.

## Benefits

- Implementers of `cli/` (the `client` agent) get an unambiguous contract for every command.
- Scripts can rely on stable exit codes and JSON shapes.
- Corrupted user config files are never destroyed by the CLI.
