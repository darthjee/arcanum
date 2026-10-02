# Node Plan: resolve_and_fetch.sh rejects a bare numeric id

Main plan: [plan.md](plan.md)

## Shared contracts

- **Input grammar** (after trimming surrounding whitespace): `^#?([0-9]+)$`. The leading `#` is optional, and `694`, `#694` and `  #694  ` all resolve to `ID=694`. Everything else is still rejected (`""`, `"   "`, `"#"`, `"#abc"`, `"# 1"`, `"#193 - title"`, `"bare title"`, `"193 - title"`).
- **Error output** for rejected input. Both implementations must produce exactly this, byte for byte:

  ```text
  STATUS=error
  ERROR=Error: invalid input '<arg_string>' — expected '<id>' or '#<id>'
  ```

- No other output changes. `STATUS=ok` lines and the fetch-error path stay the same.

## Implementation Steps

### Step 1 — Make the leading `#` optional in the native implementation
In `core/lib/commands/shared/ResolveAndFetch.js`, change `ID_PATTERN` to `/^#?([0-9]+)$/`. Update the error string in `run()` to the exact text in the shared contract, and update the JSDoc for `run()`'s `argString` and for `_parseId`, which still describes the old `^#[0-9]+$` grammar.

### Step 2 — Update the spec
In `core/spec/lib/commands/shared/ResolveAndFetch_spec.js`:
- Remove `'193'` from the invalid-input `cases` list, and add `'193 - title'`.
- Change the expected error string to the new text.
- Add success cases for a bare id (`'42'`) and a padded bare id (`'  42  '`). Each should give the same output as `'#42'`, for both the existing-local-file path and the fetch path.

## Files to Change
- `core/lib/commands/shared/ResolveAndFetch.js`: pattern, error message and JSDoc.
- `core/spec/lib/commands/shared/ResolveAndFetch_spec.js`: invalid and valid cases.

## CI Checks
- `core`: `make core-test` and `make core-lint` (CI jobs: `yarn test`, `yarn lint`).
