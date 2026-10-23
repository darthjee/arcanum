# ignore-checks
Implement `config auto-fix-all ignore-checks [list] | add <pattern>... | remove <pattern>...` (spec "`ignore-checks`").

- Repo tier only. `--local`/`--global` exit `3` through the registry tier check (`arcanum: auto-fix-all.ignored_check_patterns is repo-only`).
- `list`: prints the raw patterns one per line (nothing for an empty list, exit `0`). JSON: `{key, tier, file, patterns}`. A stored value that isn't an array exits `3` with the fix-it hint.
- `add`: at least one pattern is required (exit `2` otherwise). Before taking the lock, validate every pattern with `new RegExp(p, 'i')`. Any failure exits `3` and nothing is written. Then call `RepoConfigWriter#update` (#841) with a `mutate` that treats an absent key as `[]`, throws a validation error for a non-array, appends the new patterns in order, and skips ones already present. The #780 pre-write checks run first and are unchanged: malformed file exits `7`, version skew `5` (no `--force` on shortcuts), lock timeout `6`.
- `remove`: the same flow without regex validation. It removes by exact string, skips missing patterns, and leaves `[]` rather than deleting the key.
- Output: human lines such as `added '^codacy' to auto-fix-all.ignored_check_patterns (repo: <file>)` and `'^codacy' already present`. JSON uses the `config set` shape with whole-array `value`/`previous.value`, plus `added`/`removed`. A call where nothing changed exits `0` with `"changed": false`.

## Files to Change
- `cli/lib/commands/config/shortcuts/ignoreChecks.js` (new) — list, add and remove.
- `cli/spec/lib/commands/config/shortcuts/ignoreChecks_spec.js` (new) — add one and many, duplicate add, removing a missing pattern, removing the last pattern, absent key, non-array value (every verb), an invalid regex in a multi-pattern call (bytes unchanged), patterns after `--`, `--local`/`--global` refused, the `added`/`removed` fields, and two concurrent `add` calls against a lock held beforehand, which both end up in the file.
