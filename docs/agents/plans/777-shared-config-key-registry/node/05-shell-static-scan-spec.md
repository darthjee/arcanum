# Shell static scan spec

Implement layer 2: a spec that scans every tracked `*.sh` in the repo, excluding `node_modules` and `core/spec/support/fixtures`, for config helper calls. It builds each key with the parsing rules in [plan.md's shared contracts](../plan.md#shared-contracts) and fails, listing `file:line: key`, for any key that matches no registry entry or any call it can't parse without a preceding `# config-key:` annotation.

Known call sites that need annotations (scripter adds them; the spec must pass once they land):

- `auto-fix-all/scripts/config_{get,set,toggle,is_enabled}_shell.sh` (`$NAMESPACE` / `$KEY`);
- `init-claude/scripts/set_ci_ignored_patterns_shell.sh` (`$NAMESPACE`);
- `arcanum/migrations/repos/2.0.0/00{1,2,3}.sh` (`$NAMESPACE`);
- `repo_config_seed` calls (namespace-wide, not key-level), which the scan ignores.

Also add a unit spec over small inline shell snippets for the parser itself:

- literal keys;
- `${var}` turned into a wildcard segment;
- an unparseable call without an annotation failing;
- annotated calls, single and multiple lines;
- comment lines ignored.

## Files to Change
- `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js` — new. If the parser grows beyond a few functions, put it in `core/spec/support/utils/shellConfigKeys.js`. It stays spec-support, not shipped code.
