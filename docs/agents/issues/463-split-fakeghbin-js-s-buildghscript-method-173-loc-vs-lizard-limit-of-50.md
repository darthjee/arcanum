# Split fakeGhBin.js's buildGhScript method (173 LOC vs Lizard limit of 50)

## Context

`core/spec/support/utils/fakeGhBin.js` defines `buildGhScript`, a single function that returns the
full source of the fake `gh` CLI stand-in used across parity specs (see the file's own header
comment for the exhaustive list of `gh` subcommands it simulates: `auth switch`/`auth token`,
several `pr view --json <field>` variants, `pr merge`/`comment`/`create`/`ready`/`edit`, `api
user`/`api repos/.../check-runs`/`api repos/.../pulls/.../comments`/`api graphql`, and `issue
view`/`issue edit`). Because the whole generated bash script — including every subcommand's
`case` branch — lives inside one template literal returned by `buildGhScript`, the function's
line count (173 LOC) far exceeds this repo's Lizard limit of 50 LOC per function, even though the
logic itself is a flat, non-branching template assembly.

## What needs to be done

- Split `buildGhScript` into smaller helper functions, each building one coherent slice of the
  fake `gh` script (for example: one helper per top-level `gh` subcommand group — `auth`, `pr
  view`, `pr` mutations (`merge`/`comment`/`create`/`ready`/`edit`), `api`, and `issue` — plus a
  small top-level function that assembles the final script from the pieces).
- Keep the emitted bash script's behavior byte-for-byte identical: every subcommand, env var
  name/default, and error message documented in `fakeGhBin.js`'s header comment must keep working
  exactly as before, since the file's specs and the wider parity-spec suite that rely on this fake
  `gh` binary must keep passing unmodified.
- Keep `createFakeGhBin`'s public contract unchanged (same options, same `{ binDir, cleanup }`
  return shape) — only the internal construction of the script source should change.
- Update the JSDoc on any newly introduced helper functions, consistent with the existing style in
  the file.

## Acceptance criteria

- [ ] `buildGhScript` (and any new helper functions extracted from it) each fit within the
      project's Lizard LOC-per-function limit (50 LOC).
- [ ] The generated fake `gh` script's behavior is unchanged for every subcommand documented in
      `fakeGhBin.js`'s header comment.
- [ ] All existing specs that depend on `createFakeGhBin`/`fakeGhBin.js` continue to pass without
      modification to their expectations.
- [ ] Lizard (or the repo's configured complexity check) reports no violation for
      `core/spec/support/utils/fakeGhBin.js`.
