# Write the shared lib spec

Create `docs/agents/specs/shared-lib.md` from the decisions in #816 and #818. Use these sections, in this order:

1. **Status**: "Proposed. Nothing in this spec is implemented yet." Origin: epic #816. Source-of-truth rule: from this spec's merge on, it supersedes #816's body. Later changes are made here and not back-ported; only #816's split list may still change.
2. **Goal and Non-goals**:
   - goal: `shared/` holds code shared by `core/` and `cli/`, with the config surface as its first content;
   - non-goals: npm publishing; the `ClaudeContext` / `ConfigChain._globalConfigFile` config-dir consolidation; the shell `arcanum/_lib/*config*.sh` helpers; the review of other dev-only shipped files (#817).
3. **Layout**:
   - the tree: `shared/lib/{config,file}/`, `shared/spec/`, `package.json`, `yarn.lock`, `eslint.config.mjs`, `README.md`;
   - the 10 files that move;
   - what stays in core: `BooleanKeyConfig`, `NamespacedBooleanKeyConfig`, `DispatchFailure`;
   - why the layout is flat (no `utils/` level).
4. **Ownership**:
   - the `shared` agent's scope;
   - the narrowed `node` and `client` scopes;
   - the `keys.json` exception: `shared` owns the file, loader and schema, but any agent may add, edit or remove an entry for a key its own change introduces;
   - the reserved `shared` skill name in the install's skills dir.
5. **Import boundary**:
   - plain relative imports;
   - why a mount, copy or symlink at a core path was rejected: the native host engine, git-clone installs and zip installs have no mount or build step; a symlink means double lint and coverage, zip copies and Windows fragility; Node's `imports` field can't leave its package;
   - the two-way lint rules: `shared/lib` imports only `node:` built-ins and itself, with no dynamic `import()`; `core/` and `cli/` import only from `shared/lib/**`, never `shared/spec/**`;
   - everything under `shared/lib` is public.
6. **Migration steps**:
   - consolidate inside core (`core/lib/shared/`) → copy to `shared/` → switch;
   - the drift rule for the copy window (no change planned; if one is unavoidable, make it in both copies);
   - the diff check that opens the switch;
   - the **full spec-file inventory**: a table listing every affected file under `core/spec` and `cli/spec`, classified as *moved*, *stays in core* or *duplicated*. Derive it from the real import graph. Known *stays in core* entries: `KeyRegistryDefaults_spec.js`, `ShellConfigKeyScan_spec.js`, `support/utils/shellConfigKeys.js`, `support/strictConfigKeys.js`, and any interop or parity spec that runs `arcanum/_lib/*.sh`. Spec support helpers needed on both sides are copied into `shared/spec/support/`, never imported across folders.
7. **Packaging and runtime**:
   - the whole-repo dev bind mount;
   - `scripts/build_release_zip.sh` exclude-list semantics, so `shared/` ships;
   - the runtime image's `COPY .` plus `.dockerignore`;
   - not shipping `core/spec/` or `shared/spec/` (#821);
   - the updater's `MANIFEST` diff removing the old files.
8. **Tooling and CI**:
   - the package: zero runtime dependencies, Jasmine/c8, ESLint;
   - the `shared` compose service and volume, and `shared-*` Makefile targets;
   - the CircleCI `shared` job, with lint, specs, coverage and a non-blocking `yarn audit`;
   - the Node 22.13 floor job;
   - Codacy `--partial` plus `final` uploads coordinated with core;
   - the packaging specs: `shared/lib/` is in `--list`, and no `*/spec/` path is in `--list`.
9. **Writer additions** (#825). The behaviour contract only; names and signatures are left to #825:
   - deleting a path: a missing key is a no-op, and empty parents are not pruned;
   - an optional lock `timeoutMs`: omitted means wait forever, as today;
   - top-level writes keep siblings;
   - existing callers are unchanged.
10. **Backward compatibility**: the table from #816 (dispatcher and parity tests, CLI bundle, docker engine, release zip, zip update, git-clone update, a release cut mid-epic, shell helpers and config files; no migration). Plus the two guards: the packaging spec and the runtime smoke check.
11. **Testing**:
    - coverage enforced in `shared/`, at what item 5 reaches, rounded down;
    - the strict-keys guard is not set in `shared`'s runner, and its behaviour gets explicit specs;
    - interop and parity specs stay in core;
    - each copy is tested by its own suite during the copy window.
12. **Performance and security**:
    - nothing load-sensitive;
    - the zero-dependency packaging spec;
    - the two-way boundary;
    - the carried-over conventions: `execFile`/`spawn` with an argument array, no network in specs, no tokens printed;
    - `yarn audit`;
    - the read-only runtime image.
13. **Alternatives considered**:
    - a published npm or workspace package;
    - a mount, copy or symlink at a core path;
    - one big move instead of steps;
    - keeping the surface in core, the previous decision from `arcanum-cli/shared-config-logic.md`.
14. **Implementation order**: the item → issue table (#818–#827), with owners and dependencies, copied from #816's split.
15. **Open points and See also**: links to `arcanum-cli.md`, `arcanum-cli/shared-config-logic.md`, `arcanum-cli/key-registry.md`, `arcanum-cli/packaging-and-release.md`, and the architecture docs (`script-engine.md`, `docker-engine.md`, `install-and-release.md`, `lock-system.md`, `shared-state-and-configuration.md`, `agent-roster-and-delegation.md`).

Keep it at roughly 300–400 lines. Apply the split rule from `plan.md`'s Notes if it goes past about 500.

## Files to Change

- `docs/agents/specs/shared-lib.md`: new file.
