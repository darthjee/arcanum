# Codacy: duplication cluster — PermissionGrant_spec.js internal self-duplication (45 clone groups, 1 file)

## Context

`core/spec/lib/commands/shared/PermissionGrant_spec.js` (108 lines) repeats the same 7-9 line "grant permission / assert config updated" scenario 3-5 times at different offsets (roughly lines 25-34, 37-44, 75-82, 88-95, 101-108), varying only the permission name being granted. Codacy reports 45 clone groups and roughly 70 duplicated lines within this file.

## What needs to be done

- Replace the repeated blocks with a single `it.each(['permA', 'permB', 'permC'])`-style parameterized test.
- Drive the parameterized test with a `grantsPermission(name)` helper.

## Acceptance criteria

- [ ] The repeated grant/assert scenarios in `PermissionGrant_spec.js` are replaced by a single parameterized test covering the same permissions.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.
