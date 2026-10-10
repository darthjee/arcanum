# Rewrite migration-status.json as a string enum

Rewrite the whole map in one commit, per `docs/agents/specs/docker/dispatch.md` → "Migration of existing values":

- every `true` → `"native"` (all current keys, `dispatch-fixture-crash` included);
- `arcanum-update-run-update-apply`, `arcanum-update-run-update-check`, `auto-fix-issue-run-checks` → `"host-only"`;
- append `arcanum-check-config`, `arcanum-create-issue-start`, `arcanum-create-issue-publish`, `init-claude-set-next-step-auto` as `"native"`;
- no `"docker"` values.

Keep the existing key order and 2-space formatting. Commit this alone, via `commit_change.sh`, so the generator's history walk attributes the new keys to #739.

## Files to Change

- `arcanum/_lib/migration-status.json` — booleans → enum strings; 4 native-only keys added.
