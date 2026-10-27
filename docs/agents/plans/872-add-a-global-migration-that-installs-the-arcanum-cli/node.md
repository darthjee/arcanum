# Node Plan: Add a global migration that installs the arcanum CLI

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on what `scripter` produces in [plan.md → Shared contracts](plan.md#shared-contracts): the `config`/`run` subcommands, the install root resolved as `SCRIPT_DIR/../../../..`, the shared script at `<root>/arcanum/_lib/install_cli.sh`, version resolution from `arcanum.json` and then an exact git tag, the warning on **stdout** when neither resolves, the `<version> --no-confirm` call with the shared script's stderr merged into stdout, and exit `0` in every `run` case. Name the script as the single literal `'arcanum/migrations/repos/next/001.sh'`.

## Implementation Steps

### Step 1 — Contract spec `core/spec/bin/migrationsCliInstall_spec.js`

Follow `core/spec/bin/migrationsNextStepAuto_spec.js`: use `REPO_ROOT`, `createTempDir`/`removeTempDir` and `execFile`, and give it a header comment saying it is a contract spec, not a parity spec (the migration has no native counterpart).

Per case:
1. Build a fake install in a temp dir and copy the real `path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh')` to `<tmp>/arcanum/migrations/repos/next/001.sh`, keeping it executable.
2. Write an executable stub at `<tmp>/arcanum/_lib/install_cli.sh`. It appends its arguments to a record file, writes a line to stderr (to prove the merge into stdout), and exits with a code taken from an env var (default `0`).
3. Run the copy with `cwd` set to an unrelated temp dir, to prove the cwd is not used.

The stub never opens `/dev/tty` and the real script never prompts, so no detached-session handling is needed.

Cases:
- `config` prints `{"skippable": true}` (parse it as JSON) and exits `0`.
- An unknown subcommand, and no subcommand, both exit `1` with usage on stderr.
- `arcanum.json` with `{"version": "2.3.0"}`: the stub is called once with exactly `2.3.0 --no-confirm`, its stderr line appears in stdout, and the exit is `0`.
- No `arcanum.json`, and the install root is a git repo whose HEAD carries the tag `2.3.0`: same call, with `2.3.0`. Initialize it with `git init`, set a local `user.email`/`user.name`, make one commit and run `git tag 2.3.0`.
- No `arcanum.json`, and an untagged commit: no stub call, a stdout line containing `npm i -g arcanum-cli`, exit `0`.
- Neither `arcanum.json` nor git: same as the untagged case.
- The stub exits `1` (and also try `4`): the migration still exits `0`.
- A manifest check: `arcanum/migrations/repos/next/migrations.json` parses to exactly one entry, `{id: '001', type: 'script', file: '001.sh', skippable: true, applies_to: 'global'}`.

## Files to Change

- `core/spec/bin/migrationsCliInstall_spec.js`: new contract spec.

## CI Checks

- `core/`: `make core-test` and `make core-lint` (CI job: the core test and lint jobs).

## Notes

- Clean the git env in the tag cases (pass an `env` without `GIT_DIR`/`GIT_WORK_TREE`) so the outer repo never leaks in.
- The literal path must be exactly `'arcanum/migrations/repos/next/001.sh'` (see "Spec convention" in `docs/agents/architecture/per-repo-migrations.md`).
