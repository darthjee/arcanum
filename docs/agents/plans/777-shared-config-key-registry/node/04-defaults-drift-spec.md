# Defaults drift spec

Assert that every registry `default` equals the default the code actually applies, per [How arcanum's own code consumes the registry](../../../specs/arcanum-cli/key-registry.md#how-arcanums-own-code-consumes-the-registry).

**Node side.** Export the existing default constants, without changing their values, and compare them:

| Constant | Location | Key |
| --- | --- | --- |
| `DEFAULT_SAFE_BRANCH` | `RepoConfig.js` | `git.safe_branch` |
| `DEFAULT_MAX_RETRY_COUNT`, `DEFAULT_ERROR_SLEEP_TIME` | `SpawnIssue.js` | `plan-issues.*` |
| the `empty` fallback | `MergeBodyResolver.js` | `git.merge_body_mode` |

Do the same for any other Node-applied default in the table where one exists, e.g. the `false` of `omit_model_coauthor`, `[]` of `remove_coauthors`, and `BooleanKeyConfig.js`'s `DEFAULT_VALUE`. Hoist an inline literal into an exported constant where needed.

**Shell side.** Run each shell helper against a temp repo with no config files, and with `CLAUDE_CONFIG_DIR` pointed at an empty dir. Assert the effective value matches the registry default:

- `safe_branch.sh`'s `safe_branch_get` → `origin/main`;
- `merge_body.sh` → `empty`;
- `engine_dispatch.sh`'s mode resolution → `shell`;
- `spawn_issue_shell.sh`'s retry/sleep defaults → `5` / `5`;
- `agent_email.sh`'s omit/remove-coauthors handling;
- `auto-fix-all` config getters → `false` / `[]`.

Where a helper only applies a default implicitly, assert the observable behaviour. Keep each case table-driven, keyed by registry key, and skip keys with no default.

## Files to Change
- `core/lib/utils/config/RepoConfig.js`, `core/lib/commands/shared/SpawnIssue.js`, `core/lib/utils/github/MergeBodyResolver.js` (and any other default-holding module) — export the default constants.
- `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` — new drift spec, Node and shell cases.
