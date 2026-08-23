# Unit and parity specs

## Unit spec — `core/spec/lib/ArcanumUpdateRunUpdate_spec.js`

Cover both methods with injected fakes for `execFileAsync`, `spawnFn`, and the filesystem (`readFile`/`existsSync`, following the DI pattern used throughout `core/lib/` and `core/spec/lib/`):

- `check`: `zip`-method success (`arcanum.json` present, `.repo`/`.version` read), `git`-method success (both remote URL forms — `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git`; both current-version paths — exact tag match, and the short-hash fallback when `describe --tags --exact-match` fails), and the `STATUS=missing_arcanum` path (`bootstrap.sh` missing; neither `arcanum.json` nor `.git` present).
- `apply`: successful update (`before !== after` → `RESULT=updated FROM=... TO=...`), no-op (`before === after` → `RESULT=noop VERSION=...`), bootstrap child process nonzero exit (assert the thrown `DispatchFailure` carries `stdout: ''` and the child's own exit code), and the shared `STATUS=missing_arcanum` path (assert `resolveTarget` is checked before spawning `bootstrap.sh` at all — no child process is spawned on this path).
- Assert the spawned `bootstrap.sh` call uses `stdio: 'inherit'` and includes `ARCANUM_ASSUME_YES: '1'` in its env.

## Parity spec — `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js`

Follow the shape of the existing parity specs (e.g. `core/spec/bin/autoFixAllConfigParity_spec.js`, `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity_spec.js`): build a fixture arcanum install under a temp directory (both a `zip`-method fixture with a stub `arcanum.json`, and a `git`-method fixture — a temp git repo with an `origin` remote and a tagged/untagged commit), then for each of `check`/`apply` invoke both `arcanum-update/scripts/run_update_check_shell.sh`/`run_update_apply_shell.sh` (shell) and `core/bin/arcanum arcanum-update-run-update-check`/`-apply` (native) against the same fixture, asserting identical stdout and exit code.

- `apply`'s fixture needs a stub/fake `arcanum/update/bootstrap.sh` inside the fixture (not the real one — this parity spec shouldn't perform a real network install) that deterministically exits 0 (bumping the fixture's recorded version) or nonzero, so both the "updated" and the "bootstrap failure, exit code propagated" paths are covered without hitting the network. Reuse whatever fixture-bootstrap convention already exists under `core/spec/support/fixtures/` if one is close enough; otherwise add one scoped to this spec.
- Cover the shared `STATUS=missing_arcanum` path for both subcommands (fixture with `arcanum/update/bootstrap.sh` absent).

## Files to Change

- `core/spec/lib/ArcanumUpdateRunUpdate_spec.js` — new.
- `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` — new.
- `core/spec/support/fixtures/` — new fixture(s) for the parity spec, only if nothing suitable already exists.
