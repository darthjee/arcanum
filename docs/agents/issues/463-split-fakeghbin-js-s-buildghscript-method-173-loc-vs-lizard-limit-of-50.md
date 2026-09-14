# Issue: Split fakeGhBin.js's buildGhScript method (173 LOC vs Lizard limit of 50)

## Description

`core/spec/support/utils/fakeGhBin.js`'s `buildGhScript` function returns the full source of
the fake `gh` CLI stand-in used across parity specs (see the file's own header comment for the
exhaustive list of `gh` subcommands it simulates: `auth switch`/`auth token`, several `pr view
--json <field>` variants, `pr merge`/`comment`/`create`/`ready`/`edit`, `api user`/`api
repos/.../check-runs`/`api repos/.../pulls/.../comments`/`api graphql`, and `issue
view`/`issue edit`). The entire generated bash script — including every subcommand's `case`
branch — lives inside one template literal returned by this single function.

## Problem

`buildGhScript` is 173 LOC, far exceeding this repo's Lizard limit of 50 LOC per function, even
though the logic itself is a flat, non-branching template assembly — there's no real JS control
flow, just one large string. Lizard counts the function's source lines regardless of how flat its
logic is, so the fix is structural (split the function into smaller pieces), not logical.

## Solution

Split `buildGhScript` into one helper per top-level `gh` subcommand group, each returning the
bash source for that group's `case` branch, plus a small top-level function that assembles the
final script:

| New helper | Returns the `case` branch for | Approx. lines |
|---|---|---|
| `buildAuthCase(authTokenAlwaysFails)` | `auth switch` / `auth token` | ~15 |
| `buildPrViewCase()` | `pr view` (all `--json <field>` variants, incl. the `_json_flag_value` lookup helper) | ~50 |
| `buildPrMutationCase()` | `pr merge` / `comment` / `create` / `ready` / `edit` | ~40 |
| `buildApiCase()` | `api user` / `api repos/.../check-runs` / `api repos/.../pulls/.../comments` / `api graphql` | ~20 |
| `buildIssueCase()` | `issue view` / `issue edit` | ~20 |
| `buildGhScript(authTokenAlwaysFails)` | shebang, `set -euo pipefail`, the top-level `case "${1:-}"` dispatch assembling the pieces above, and the final "unrecognized invocation" fallback | ~25 |

Each helper takes only the parameters it needs — only `buildAuthCase` needs
`authTokenAlwaysFails`, since `auth token` is the only subcommand baking a build-time constant
into the script. `buildGhScript` interpolates each helper's output into the same overall bash
structure the file has today (same variable names, same `case` nesting, same error messages), so
the emitted script stays byte-for-byte identical to what's generated today.

Verification: while refactoring, diff `buildGhScript(false)`/`buildGhScript(true)`'s output
string before and after the split to confirm byte-for-byte equivalence, then rely on the existing
parity-spec suite (which exercises `createFakeGhBin` transitively) to confirm nothing broke — this
issue does not require adding a new dedicated spec file for `fakeGhBin.js` itself.

### Done when

- [ ] `buildGhScript` and every new helper extracted from it fit within the project's Lizard
      LOC-per-function limit (50 LOC).
- [ ] The generated fake `gh` script's behavior is unchanged for every subcommand documented in
      `fakeGhBin.js`'s header comment.
- [ ] All existing specs that depend on `createFakeGhBin`/`fakeGhBin.js` continue to pass without
      modification to their expectations.
- [ ] Lizard (or the repo's configured complexity check) reports no violation for
      `core/spec/support/utils/fakeGhBin.js`.

### Out of scope

- Any change to `createFakeGhBin`'s public options or its `{ binDir, cleanup }` return shape.
- Any change to which `gh` subcommands are simulated or how each one behaves.

## Benefits

- Brings `buildGhScript` (and each new helper) under the repo's Lizard LOC-per-function limit.
- Groups each `gh` subcommand's simulated behavior into its own named, independently readable
  helper, instead of one 173-line function.
- Pure internal refactor — `createFakeGhBin`'s public contract and every simulated subcommand's
  behavior are unchanged, so this carries very low review/regression risk.
