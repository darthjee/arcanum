# Node Plan: Scaffold cli/ with esbuild bundling

Main plan: [plan.md](plan.md)

## Shared contracts

- `infra` adds `cli/` to `scripts/build_release_zip.sh`'s `EXCLUDES`, so `build_release_zip.sh --list` prints no `cli/` path. Your spec asserts exactly that. Until the change lands, the new `it` fails if `cli/` already exists in git, which is expected.

## Implementation Steps

### Step 1 — Assert the release zip lists no `cli/` path

In `core/spec/release/buildReleaseZipList_spec.js`, add an `it` block to the existing `describe` so it reuses the single `--list` run from `beforeAll`:

```js
const CLI_PREFIX = 'cli/';
it('lists nothing under cli/', () => {
  expect(paths.filter((line) => line.startsWith(CLI_PREFIX))).toEqual([]);
});
```

Update the header comment to mention #779 alongside #797.

## Files to Change

- `core/spec/release/buildReleaseZipList_spec.js` — new `it` block plus the header comment.

## CI Checks

- `core/`: `make core-check` (CI jobs: `test`, `checks`)

## Notes

- Precondition confirmed during planning: no shared-surface module uses `import.meta.url` or `__dirname`. `core/lib/utils/file/InstallRoot.js` does, but it is not on the surface and no surface module imports it.
