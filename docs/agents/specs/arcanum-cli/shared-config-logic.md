# Arcanum CLI: Shared Config Logic

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define how the CLI reuses arcanum's existing config read/write code, so that it reads and writes config exactly like the skills do: same tier files, same dotted-path semantics, same locking.

## Decisions

### Source stays in `core/`

The config logic stays in `core/` as the single source, owned by `node`:

- `core/lib/utils/config/`: `ConfigChain`, `RepoConfig`, `RepoConfigWriter`, `BooleanKeyConfig`;
- `core/lib/utils/file/Lock.js`, which is compatible with the shell lock.

Together these are about 900 lines.

### Bundle at build time with `esbuild`

The CLI build uses **`esbuild`** to bundle three things into a single self-contained file in the `arcanum-cli` package:

- the CLI itself;
- the shared `core/lib` files above;
- the [Key Registry](key-registry.md).

`esbuild` is a devDependency only, so the runtime stays zero-dependency. `core/` is not part of the npm package, so the CLI cannot import `core/lib` at runtime.

### Guardrails

- **Declared shared surface.** This spec lists exactly which `core/lib` files the CLI may bundle (the list above). They may import only node built-ins and each other. An ESLint `no-restricted-imports` rule enforces this.
- **Decouple `DispatchFailure`.** Today `BooleanKeyConfig.js` imports `core/lib/utils/errors/DispatchFailure.js`, which is the shared surface's only non-built-in import outside itself. The shared code instead throws a neutral error (e.g. `ConfigError`). The dispatcher maps it to `DispatchFailure`, keeping today's stdout and exit codes. The CLI maps it to its own messages and exit codes.
- **CI coupling.** CLI specs and the bundle build also run when a shared-surface file or the registry changes, so `core` edits cannot silently break the CLI.

### Future work

Extracting the shared config logic into its own npm package is a separate follow-up issue, outside epic #767. That issue must deal with `core` shipping with zero runtime npm dependencies inside the release zip and the Docker image, so `core` cannot simply depend on a published package. A likely shape: an in-repo workspace package that `core` imports locally and that is published to npm for the CLI.

## Alternatives considered

- **Extracting a shared workspace package now.** Rejected: it needs a new root folder, import churn in `core`, and Docker/Makefile changes. That is too much for about 900 lines. It is kept as future work.
- **A plain copy script instead of `esbuild`.** Rejected: copied files keep their relative imports and need their own module layout in the package, whereas a bundle is one self-contained file.
- **Reimplementing the config logic in the CLI.** Rejected: it would drift from arcanum, especially the locking.
- **Importing `core/lib` at runtime.** Impossible: `core/` is not shipped in the npm package.

## Open points

- The exact shared-surface file list, including whether the JSDoc type-only references to `core/lib/context/RepoContext.js` in `ConfigChain` and `RepoConfig` need to change.
- The shape of `ConfigError` and how it maps to `DispatchFailure` and to CLI exit codes.
- How CI detects shared-surface changes (path filters versus always running the CLI job).
- Lock interoperability details with the shell `arcanum/_lib/lock.sh`, when the CLI and a running skill touch the same file (see [Lock System](../../architecture/lock-system.md)).
