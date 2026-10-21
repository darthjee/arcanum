# Scaffold cli/ with esbuild bundling

## Context

Part of epic #767 (Arcanum user-facing CLI for configuration). The design lives in the [Arcanum CLI spec](../specs/arcanum-cli.md) and its parts, mainly [Packaging and Release](../specs/arcanum-cli/packaging-and-release.md) and [Shared Config Logic](../specs/arcanum-cli/shared-config-logic.md).

The prerequisites have landed: the `client` agent (#775), the shared config surface refactor in `core/lib` (#778), the key registry (#777), the lock protocol fix (#807) and the `monitor-issues` consolidation (#776). No `cli/` folder exists yet.

This issue creates the `cli/` project for the `arcanum-cli` npm package: the manifest, the Node-floor entrypoint, the command router, the `esbuild` build, the lint/spec tooling, and the CI and local tooling that run them. It ships no real `config` subcommand yet. Those come in #780 (generic commands), #781 (shortcuts) and #782 (wizard). The npm publish job is #783.

## What needs to be done

**`client` (`cli/`):**

- `cli/package.json`, per [Packaging and Release → `cli/package.json`](../specs/arcanum-cli/packaging-and-release.md#clipackagejson):
  - `name: arcanum-cli`, `version` equal to `arcanum.version`, `type: module`, `bin: {"arcanum": "bin/arcanum"}`.
  - `files: ["bin/", "dist/", "README.md"]`, `engines.node` equal to `core/package.json`'s (`>=22.13.0`), `publishConfig: {"access": "public", "tag": "latest"}`.
  - Scripts `build`, `prepack: "yarn build"`, `test`, `lint`.
  - No `dependencies`, no install lifecycle scripts.
  - Exact-version devDependencies (Jasmine, c8, ESLint and the plugins `core/` uses, `esbuild`), pinned by a committed `cli/yarn.lock`.
- `cli/bin/arcanum`: an unbundled, syntax-conservative gate. It compares `process.versions.node` with the floor literal, prints `Node.js >= 22.13.0 required, found X` and exits `1` when too old, and only then dynamically imports `../dist/arcanum.mjs`.
- `cli/lib/main.js`: the bundle entry and command router, built on `node:util`'s `parseArgs` with a thin in-house subcommand/help layer.
  - It handles `--help` and `--version`. The version comes from the `__ARCANUM_CLI_VERSION__` define.
  - An `arcanum config` namespace stub prints its help.
  - Unknown commands are usage errors (exit `2`).
- `cli/scripts/build.mjs`: the `esbuild` build through its JS API, per [Shared Config Logic → Bundle at build time with `esbuild`](../specs/arcanum-cli/shared-config-logic.md#bundle-at-build-time-with-esbuild).
  - Options: `bundle`, `platform: node`, `format: esm`, `target` derived from `engines.node`, no minify, no sourcemap, a `define` for the version, and `metafile`.
  - Output: `cli/dist/arcanum.mjs`. `cli/dist/` is gitignored.
  - Metafile surface check: fails if any bundled input lies outside `cli/lib/**` plus the shared-surface files read from core's ESLint shared-surface block.
  - The embedded per-scope migration-version list (`__ARCANUM_MIGRATION_VERSIONS__`), per [Packaging and Release → Embedded migration-version list](../specs/arcanum-cli/packaging-and-release.md#embedded-migration-version-list).
- `cli/eslint.config.mjs`: the same style rules as `core/`, plus the CLI-side rule restricting `core/lib` imports to the shared-surface entry files.
- `cli/spec/`: Jasmine with c8, mirroring `cli/lib/`. It includes:
  - manifest specs;
  - lockstep specs (version, `engines.node`, the floor literal in `cli/bin/arcanum`);
  - migration-list specs on fixture trees, plus one against the real `arcanum/migrations/repos/`;
  - smoke specs that run the built bundle through `cli/bin/arcanum` (`--version`, `--help`).
- `cli/README.md` stub (developer README, also the npm page).
- The `cli/` row in `docs/agents/folder-structure.md`.

**`infra`:**

- Docker/docker-compose/Makefile `cli-*` targets for installing, linting, building and running the CLI specs, like the `core-*` ones.
- A CircleCI `cli` job in the `test` workflow, on every push with no path filters: `yarn install --frozen-lockfile`, lint, build, specs (including the smoke specs), and a non-blocking `yarn audit`.
- A CircleCI job running the `cli/` specs on Node 22.13 exactly.
- `scripts/bump-version.sh` also rewrites `cli/package.json`'s `version`, so the lockstep spec keeps passing across releases.

**`node`:**

- A `core/spec` packaging check that `scripts/build_release_zip.sh --list` contains no `cli/` path.

Out of scope: the `get/set/unset/list/info` commands (#780), the shortcuts (#781), the wizard (#782), the `publish-cli` job and `scripts/publish_cli_package.sh` (#783), and the user guide (#784).

## Acceptance criteria

- [ ] `cli/` exists with `package.json`, `yarn.lock`, `bin/arcanum`, `lib/main.js`, `scripts/build.mjs`, `eslint.config.mjs`, `spec/` and `README.md`, laid out as in the spec. `cli/dist/` is gitignored.
- [ ] `cli/package.json` matches the spec's field table: no runtime dependencies, no install scripts, exact devDependency versions.
- [ ] `yarn build` produces a single, unminified `cli/dist/arcanum.mjs`. The build fails if the metafile shows an input outside `cli/lib/**` and the declared shared surface.
- [ ] The build embeds the per-scope migration-version list. Released `X.Y.Z` directories are listed and `next/` is skipped, semver-sorted and capped at the CLI version. An invalid `applies_to` fails the build.
- [ ] `arcanum --version` prints the CLI version, `arcanum --help` and `arcanum config --help` print help, and an unknown command exits `2`.
- [ ] `cli/bin/arcanum` exits `1` with the required-version message on a Node below the floor.
- [ ] The lockstep specs pass: `cli/package.json` `version` equals `arcanum.version`, and `engines.node` equals `core/package.json`'s and the floor literal in `cli/bin/arcanum`.
- [ ] `cli/eslint.config.mjs` rejects `core/lib` imports outside the shared-surface entry files.
- [ ] `make` `cli-*` targets run the CLI lint, build and specs in Docker.
- [ ] The CircleCI `test` workflow has a `cli` job and a Node 22.13 floor job, both green.
- [ ] `scripts/bump-version.sh` bumps `cli/package.json`'s `version`.
- [ ] A `core/spec` check asserts no `cli/` path is in the release zip.
- [ ] `docs/agents/folder-structure.md` has a `cli/` row.
