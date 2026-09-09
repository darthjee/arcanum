# node Plan: Migrate ArcanumUpdateRunUpdate to a constructor-injected ClaudeContext (context: 'claude')

Main plan: [plan.md](plan.md)

## Steps

- [01 — Give the command registry entries context: 'claude'](node/01-add-context-to-commands-registry.md)
- [02 — Migrate ArcanumUpdateRunUpdate to take claudeContext](node/02-migrate-arcanumupdaterunupdate.md)
- [03 — Verify dispatcher and shell-engine wiring need no change](node/03-verify-dispatcher-and-shell-wiring.md)
- [04 — Update specs](node/04-update-specs.md)

## CI Checks

- `core/`: `make core-test` (unit + parity specs) and `make core-lint` — no dedicated CI
  workflow file exists in this repo (`.github/workflows/`); these are the same commands
  a contributor runs locally, per the issue's "Done when".

## Notes

- **Do not delegate `_resolveTarget`'s missing-arcanum check to
  `ClaudeContext#validateInstall()`.** `validateInstall()` (added by #419) does the same
  `bootstrapPath()`/`arcanumJsonPath()`/`gitDirPath()` existence check `_resolveTarget`
  already does, but *also* runs an anti-drift `realpath` identity check against this
  install's own `INSTALL_ROOT` (`core/lib/utils/file/InstallRoot.js`) — rejecting with a
  plain `Error` (not `DispatchFailure`) whenever the target path isn't literally the
  running arcanum checkout. Both the unit specs (`stubDeps` + synthetic `REPO_PATH`) and
  the parity specs (`arcanumUpdateRunUpdateParitySetup.js`'s `createZipFixture`/
  `createGitFixture`, each a throwaway temp dir) construct/target install paths that are
  never this repo's own `INSTALL_ROOT`, so wiring in `validateInstall()` would make every
  one of those specs fail — a real regression, not a fixture quirk, since production usage
  is unaffected (the CLI's `TARGET_PATH` is always the running install's own self-resolved
  location; drift can never legitimately occur there). The issue's Solution section already
  frames this as a choice ("either delegate to `ClaudeContext#validateInstall()` or reuse
  the same existence checks locally") — reuse the existence checks locally, via the
  context's `bootstrapPath()`/`arcanumJsonPath()`/`gitDirPath()` accessors for *paths* only,
  keeping the manual `existsSync` calls `_resolveTarget` already makes. This also keeps the
  `STATUS=missing_arcanum` / stdout contracts byte-identical, per "Done when".
- The actual "never drifts" benefit named in the issue comes from removing the
  caller-suppliable `repoPath` positional in favor of a `Dispatcher`-constructed context —
  not from invoking the anti-drift check itself. That check remains available for a future
  issue to wire in deliberately, with its own test-fixture implications considered
  separately.
