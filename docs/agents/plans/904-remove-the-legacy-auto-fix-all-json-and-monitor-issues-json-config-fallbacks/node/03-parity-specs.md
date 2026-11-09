# Parity specs and fixtures

Update the shell-versus-native parity specs to the new contract. Both engines must ignore a legacy file that is present.

- **`autoFixAllConfigParitySetup.js`:** keep the `legacyConfig` option of `seedConfig`. It is how the negative cases plant a legacy file. Update its JSDoc to say it exists to prove the file is ignored.
- **`autoFixAllConfigParity/*_spec.js`:** turn "a key present only in the legacy file" into "ignores a key present only in the legacy file". Both engines print nothing for `get`, and false for `is-enabled`. Turn any set/toggle seed cases into "does not seed".
- **`monitorIssuesConfigParity/config_spec.js`:** the same for "get: … only in the legacy file" and "set: … seeding the namespace from the legacy file". Fix the header comment.
- **`initClaudeSetCiIgnoredPatternsParity_spec.js`:** replace "seeds the namespace from the legacy auto-fix-all.json" with "ignores the legacy auto-fix-all.json". Both engines write only `ignored_check_patterns`.

## Files to Change

- `core/spec/support/factories/autoFixAllConfigParitySetup.js`: JSDoc only.
- `core/spec/bin/autoFixAllConfigParity/get_spec.js` (and any sibling spec with legacy cases): change them to "ignored" cases.
- `core/spec/bin/monitorIssuesConfigParity/config_spec.js`: change the legacy cases to "ignored" cases, and fix the header.
- `core/spec/bin/initClaudeSetCiIgnoredPatternsParity_spec.js`: change the seed case to an "ignored" case.
