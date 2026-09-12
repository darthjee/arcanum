# node Plan: Migrate discuss-issue-confirm entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Registers `'discuss-issue-confirm'` in `core/lib/core/commands.js`'s `COMMANDS` map — this exact string must match the `migration-status.json` key and the `<command>` argument scripter's shim passes to `engine_dispatch`. No `context` key (omitted entirely, matching `auto-fix-issue-list-plan-agents`'s precedent, since there is no `<repo_path>` to build a `RepoContext` from).
- Writes the parity test against `discuss-issue/scripts/confirm_shell.sh` — the exact path scripter's rename produces — invoked directly, never through the shim.
- The entrypoint never writes to stdout or stderr, in either outcome — see Step 1 below for the exact `DispatchFailure` idiom this requires, precedent'd by `AutoFixAllConfig.isEnabled`.

## Implementation Steps

### Step 1 — Implement the native module and register it

Create `core/lib/commands/discuss-issue/DiscussIssueConfirm.js`. This module needs no constructor/injectable dependencies at all — it does no I/O, no `child_process`, no config reads, purely string normalization on its one argument — so skip the `constructor({...} = {})` boilerplate every other migrated module has and write a single `run(reply)` method.

Read `discuss-issue/scripts/confirm.sh` for the exact normalization pipeline and replicate its **order of operations** precisely (a single combined trim regex is not equivalent in edge cases — e.g. `"yes  ."` yields `"yes  "`, not `"yes"`, because trailing-whitespace stripping runs *before* trailing-punctuation stripping, exposing new trailing whitespace that is never stripped a second time):

```js
const normalized = reply
  .toLowerCase()
  .replace(/^\s+/, '')
  .replace(/\s+$/, '')
  .replace(/[.!?]+$/, '');
```

Note for the parity test (not a required behavior change): `tr '[:upper:]' '[:lower:]'` is ASCII-only, while `String.prototype.toLowerCase()` is Unicode-aware, and POSIX `[[:space:]]` is a narrower class than JS `\s`. This is a latent divergence risk worth a comment in the module, even though none of the current affirmative words (`yes`, `y`, `sim`, `correct`, `looks good`, `sure`, `ok`, `okay`) or documented negatives (`no`, `n`, `não`, `nao`, `nope`) trigger it today.

Match against the fixed affirmative set — `yes`, `y`, `sim`, `correct`, `looks good`, `sure`, `ok`, `okay` (note: `"looks good"` is a literal bash `case` string match, not a glob, so it is exactly `looks good` including the single interior space).

Signal the outcome the same way `AutoFixAllConfig.isEnabled` signals its own boolean-check contract (`core/lib/commands/auto-fix-all/AutoFixAllConfig.js`) — **not** the `throw new Error(USAGE)`-on-missing-argument pattern used elsewhere:

```js
async run(reply) {
  const normalized = /* ... normalization above ... */;

  if (!AFFIRMATIVE.has(normalized)) {
    throw new DispatchFailure('', 1);
  }
  // implicit return (undefined) on a match — dispatch() writes nothing
  // to stdout and leaves exitCode at its default 0, exactly like the
  // shell script's bare `exit 0`.
}
```

A missing/empty `reply` argument needs no special-cased check — `''` simply normalizes to `''`, which isn't in `AFFIRMATIVE`, so it falls into the same `DispatchFailure('', 1)` path as any other non-affirmative reply. Do not add an upfront "is `reply` present" guard that throws a plain `Error` — that would print `arcanum: <message>` to stderr, which `confirm_shell.sh` never does for any input.

Register in `core/lib/core/commands.js`'s `COMMANDS` map, alphabetically between `'dispatch-fixture-crash'` and `'github-issue-create'`:

```js
'discuss-issue-confirm': { module: 'commands/discuss-issue/DiscussIssueConfirm.js', method: 'run' },
```

### Step 2 — Unit and parity tests

Write `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js` (Jasmine): cover every affirmative word/phrase individually (case-insensitive, with surrounding whitespace and trailing `.`/`!`/`?`), every documented negative (`no`, `n`, `não`, `nao`, `nope`), an arbitrary unrecognized string, and a missing/empty argument — asserting the missing-argument case rejects with `DispatchFailure` (empty `.stdout`, `.exitCode === 1`) exactly like every other non-affirmative case, not with a plain `Error`.

Write `core/spec/bin/discussIssueConfirmParity_spec.js` (mirroring `autoFixIssueListPlanAgentsParity_spec.js`'s structure for a context-less, no-git entrypoint): compare `discuss-issue/scripts/confirm_shell.sh "<reply>"` directly against `core/bin/arcanum discuss-issue-confirm "<reply>"` for byte-identical stdout (both empty in every case) and exit code, across at minimum: each affirmative word, a negative, an unrecognized reply, and a missing argument (invoked with zero args on both sides).

## Files to Change

- `core/lib/commands/discuss-issue/DiscussIssueConfirm.js` — new native module.
- `core/lib/core/commands.js` — add the `discuss-issue-confirm` entry.
- `core/spec/lib/commands/discuss-issue/DiscussIssueConfirm_spec.js` — new unit tests.
- `core/spec/bin/discussIssueConfirmParity_spec.js` — new parity tests.

## CI Checks

- `core/`: `yarn test` (CI job: `test`, `.circleci/config.yml`) — local equivalent: `make core-test`.
- `core/`: `yarn lint` (CI job: `checks`, `.circleci/config.yml`) — local equivalent: `make core-lint`.

## Notes

- No `ConfigChain`, `RepoContext`, or `execFile`/`spawn` usage at all — this is the simplest entrypoint migrated in this batch's era; resist adding dependency-injection scaffolding this module has no use for.
