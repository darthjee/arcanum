# Issue: Codacy: duplication cluster — PermissionGrant_spec.js internal self-duplication

## Description

`core/spec/lib/commands/shared/PermissionGrant_spec.js` (`describe('PermissionGrant')` → `#add`) contains several tests that repeat the same three-step "arrange / call `add` / assert the JSON file" boilerplate:

```js
const permissionGrant = new PermissionGrant(claudeContext, { lock: new Lock({ sleepMs: 5 }) });

await permissionGrant.add(file, 'Bash(git push:*)');

const written = JSON.parse(await readFile(file, 'utf8'));

expect(written).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
```

Codacy reports this block (and overlapping variants of it) as clone groups within the file. Note this repeats the **same** permission string (`'Bash(git push:*)'`) every time — the tests vary by *initial file state* (missing, already containing the pattern, invalid JSON, empty file), not by permission name.

## Problem

The original issue description said the repeated blocks vary "only the permission name being granted," suggesting a fix shaped like `it.each(['permA', 'permB', 'permC'])`. Re-checking the file as it stands on `main` (commit `8089d74`, matching Codacy's last-analysed commit) shows that's not accurate: every repeated block grants the *same* permission string, `'Bash(git push:*)'`. The five tests that actually duplicate this arrange/assert boilerplate are:

- `creates the file (starting from {}) when it does not exist yet`
- `resolves a repo-relative file against the context anchor, not process.cwd()`
- `dedupes when the pattern is already present`
- `treats missing/invalid JSON in an existing file as {}`
- `treats an existing but empty file as {}`

They differ only in (a) what, if anything, is written to `file` before calling `add`, and (b) whether `add` is called with the absolute `file` path or the repo-relative `.claude/settings.json` string — not in the permission being granted. The other three tests in the file (`leaves every other top-level key... untouched`, `degrades silently...`, `acquires and releases the lock...`, `does not corrupt the file under two near-simultaneous writes`) have distinct enough arrangements/assertions that they are not good candidates for the same parameterized table.

Separately, Codacy's current clone data for this file shows some of the flagged clone groups actually span into `AutoFixAllConfig_spec.js` / `AutoFixAllQueuePop_spec.js` (cross-file), not just internal self-duplication as the issue title states — those are out of scope for this issue, which only covers `PermissionGrant_spec.js` itself.

## Expected Behavior

- [ ] The five duplicated grant/assert scenarios in `PermissionGrant_spec.js` are replaced by a single parameterized test covering the same cases (missing file, repo-relative target, already-present pattern, invalid JSON, empty file).
- [ ] The other four tests in the file (untouched-keys, degrades-silently, lock acquire/release, concurrent writes) are left unchanged.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's internal duplication clone groups for this file drop after the fix lands.

## Solution

- Replace the five duplicated "arrange (optionally seed `file`) / call `add(target, 'Bash(git push:*)')` / assert the JSON file equals `{ permissions: { allow: ['Bash(git push:*)'] } }`" tests with a single `it.each([...])`-driven test, parameterized by a short description, an optional setup step (what to write to `file` beforehand, if anything), and the target passed to `add` (absolute `file` vs `.claude/settings.json`).
- Leave the four structurally distinct tests (`leaves every other top-level key... untouched`, `degrades silently...`, `acquires and releases the lock...`, `does not corrupt the file under two near-simultaneous writes`) as-is — they are not part of this duplication cluster.
- Do not attempt to also collapse the cross-file overlap with `AutoFixAllConfig_spec.js` / `AutoFixAllQueuePop_spec.js` as part of this issue.
