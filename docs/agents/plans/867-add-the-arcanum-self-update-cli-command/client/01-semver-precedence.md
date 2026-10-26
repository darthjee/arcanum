# Semver precedence in compareVersions

Make `compareVersions` in `cli/lib/skew.js` follow semver precedence, hand-written (no `semver` dependency):

- compare `MAJOR.MINOR.PATCH` numerically as today;
- a version with a prerelease ranks below the same version without one (`2.3.0-rc.1` < `2.3.0`);
- two prereleases compare identifier by identifier: numeric identifiers numerically, alphanumeric ones lexically (ASCII), numeric below alphanumeric, and a shorter set ranks lower when all preceding identifiers are equal;
- build metadata (`+...`) is ignored.

This also fixes the version-skew checks (a CLI at `2.3.0-rc.1` now ranks below a pointer at `2.3.0`). Keep existing `skew_spec.js` cases passing and add precedence cases (the semver.org example chain `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0`, plus the skew effect above).

## Files to Change
- `cli/lib/skew.js` — prerelease-aware `compareVersions` (export it for reuse by `self-update`).
- `cli/spec/lib/skew_spec.js` — precedence cases.
