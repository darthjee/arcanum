# Parity specs

Add one shell-vs-native parity spec per command, modelled on `core/spec/bin/autoFixIssueListPlanStepsParity_spec.js`. Run `init-claude/scripts/<name>_shell.sh` directly, with `cwd` set to a temp project dir. Run `core/bin/arcanum <command> <tempDir> <args...>` in a second, equivalent temp dir. Assert identical stdout, stderr and exit code, and byte-identical resulting files.

- set-ci-ignored-patterns: new file, `--clear`, multiple patterns, an existing file with other namespaces, seeding from the legacy `auto-fix-all.json`, and an arg containing `\n`.
- setup-templates: empty project, all present, and a mix (created plus skipped).
- stamp-arcanum-version: runs against the real install. On the CI checkout that is usually a git clone without an exact tag, which exercises the no-op path. Assert that neither engine creates any file. Optionally cover the stamping path with a `HOME`/tag-independent fixture, if the shell side can be pointed at one without copying the install. Otherwise the unit specs cover it.

## Files to Change
- `core/spec/bin/initClaudeSetCiIgnoredPatternsParity_spec.js` — new.
- `core/spec/bin/initClaudeSetupTemplatesParity_spec.js` — new.
- `core/spec/bin/initClaudeStampArcanumVersionParity_spec.js` — new.
