# Write the architecture doc

Create `docs/agents/architecture/shared-lib.md`, titled `# Shared Lib`. It describes `shared/` as built and stands on its own after #827 deletes the spec. Base it on `docs/agents/specs/shared-lib.md`, and check each fact against the tree: `shared/package.json`, `shared/eslint.config.mjs`, `core/eslint.config.mjs`, `cli/eslint.config.mjs`, `cli/scripts/build.mjs`, the root `Makefile`, `.circleci/config.yml`, `core/docker-compose.yml`, `scripts/build_release_zip.sh`, `.dockerignore`, and `shared/lib/config/RepoConfigWriter.js`. Where the spec and the code disagree, describe the code.

Sections:

1. **Purpose.** Code shared by `core/` and `cli/`. Its first content is the config surface the CLI bundles. New code both consumers need goes into `shared/`, not `core/lib`. Non-goals, briefly: no npm publishing, no runtime dependencies, the shell `*config*.sh` helpers are not included, and the CLI-only behaviours (malformed-file refusal, `--claude-config-dir`, exit codes) stay in `cli/`.
2. **Layout.** The tree of `shared/lib/{config,file}/` and `shared/spec/{config,file,support}/`, plus `package.json`, `yarn.lock`, `eslint.config.mjs` and `README.md`. List what stays in core (`BooleanKeyConfig`, `NamespacedBooleanKeyConfig`, `DispatchFailure`, `InstallRoot`, `InstallVersion`, `IssueFileLocator`, `IssueStatePaths`) and why.
3. **Import boundary.** `shared/lib/**` imports only `node:` built-ins and `shared/lib/`, with no dynamic `import()`. Everything in `shared/lib` is public, with no allowlist. `core/` and `cli/` import it by relative path (the reason is the `package.json` `imports` limitation) and never import `shared/spec/**`. Name the rules that enforce this in each ESLint config, and the `cli/scripts/build.mjs` metafile surface check. Note that `shared` is a reserved skill name in the install's skills dir.
4. **Ownership.** `shared` owns the folder, and never edits `core/` or `cli/`. `node` and `client` request changes through `architect`. A PR that changes the surface keeps core's parity specs and the CLI specs green, with the plan split across owners. Include the `keys.json` exception. Link to [Agent Roster and Delegation](agent-roster-and-delegation.md).
5. **Packaging and runtime.**
   - Dev bind mount.
   - Release zip (`EXCLUDES`) and runtime image (`.dockerignore`, `COPY .`, `/opt/arcanum/shared/`).
   - Specs are not shipped (#821).
   - The packaging specs: `shared/lib/` is included; no `*/spec/` path is.
   - `make core-smoke-runtime` runs a native config command in the image.
   - The updater's `MANIFEST` diff and git-clone updates.
   - The CLI bundle via `esbuild`.
   - Link to [Install and Release](install-and-release.md) and [Docker Engine](docker-engine.md).
6. **Tooling and CI.**
   - The package (zero runtime deps, devDependencies, `type: module`, `engines.node`).
   - The `shared` compose service and the `shared-*` Makefile targets (use the real target names, e.g. `make shared-check`).
   - The CircleCI `shared` job and the Node-floor job (use the real job names).
   - Codacy partial uploads and the non-blocking `yarn audit`.
7. **Testing.**
   - Enforced c8 coverage (state the real thresholds from `shared/package.json`).
   - No `ARCANUM_STRICT_CONFIG_KEYS` in `shared`'s runner, with the guard's own specs.
   - The interop and parity specs stay in `core/spec`.
   - The zero-dependency packaging spec.
8. **Writer API.** `RepoConfigWriter` and its methods as built, from the JSDoc:
   - `write` with an optional `namespace` (a root write ignores `legacyFile`);
   - `setVersion`;
   - `unset`: legacy seeding; no-op when the key, file or parent is missing; `NOT_AN_OBJECT`; empty parents kept;
   - the optional `timeoutMs` on every method, which throws `LockTimeoutError` (`LOCK_TIMEOUT`).

   Cover the lock on `<file>.lock` and the atomic tmp+rename write. Link to [Lock System](lock-system.md).
9. **Security.**
   - Zero runtime dependencies, enforced by a spec.
   - The two-way boundary.
   - Core's safety conventions (`execFile` with an argument array, no network in specs, never print a token).
   - Its own `yarn.lock` and `yarn audit`.
   - The read-only runtime image.
10. **Alternatives considered.** Short bullets: a published or workspace package; a mount, copy or symlink at a core path; keeping the surface in core.
11. **See also.** [Script Engine](script-engine.md), [Shared State & Configuration Files](shared-state-and-configuration.md), the [Arcanum CLI spec](../specs/arcanum-cli.md) (until #785/#786 promote it).

Leave out the migration history: the migration steps, the spec-file inventory, the copy window and drift rule, the implementation order, and the backward-compatibility table for the move. A one-line pointer to epic #816 is enough.

## Files to Change

- `docs/agents/architecture/shared-lib.md`: new.
