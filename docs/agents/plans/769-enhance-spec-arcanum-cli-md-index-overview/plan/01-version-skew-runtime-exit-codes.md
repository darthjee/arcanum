# Version skew, runtime and exit codes

Rewrite the index's "Version skew" section and add two new sections, using the issue's "Version skew" and "Minimum Node.js version" decisions.

**"Version skew" section (rewrite):**

- Each tier has its own version pointer (list the three files and fields); migrations are scoped per tier (`applies_to: repo|local|global`), so tiers can differ. Pointers hold an arcanum version, not a migration number. Missing pointer = `0.0.0` (as in `arcanum/migrations/run.sh`).
- Detection: compare the relevant tier's pointer with the CLI's own version (lockstep with arcanum). On a write, only the target tier's pointer matters.
- **Tier ahead** (pointer > CLI): reads allowed with a stderr warning suggesting `npm i -g arcanum-cli@latest`; writes refused ("version skew refused" exit code) unless `--force`.
- **Tier behind** (pointer < CLI): reads and writes allowed; stderr warning suggesting `/arcanum-migrate` only when that tier's scope has pending migrations between the pointer and the CLI version. The build embeds the per-scope migration-version list from `arcanum/migrations/repos/*/migrations.json` (detailed in Packaging and Release).
- **Equal:** silent.
- Future work: per-key granularity via a `since`/`moved_in` registry field (detailed in Key Registry).
- Rejected alternative (add to "Alternatives considered" too): comparing with the arcanum install's `arcanum.json` — the CLI cannot reliably locate the install, and the pointers describe the files' shape.

**New "Runtime" section (Node.js):**

- `engines.node` = `>=22.13.0`, in lockstep with `core/package.json`, enforced by a `cli/` spec; esbuild `target` derives from it.
- `cli/bin/arcanum` is a tiny syntax-conservative entrypoint: checks `process.versions.node`, prints "Node.js >= 22.13.0 required, found X" and exits with the generic error code if too old, then dynamically `import()`s the bundle (npm only warns on `engines`).
- A CircleCI job (`infra`) runs the `cli/` specs on Node 22.13 exactly.
- Raising the floor follows `core`, decided by `node` with `architect`; breaking for both native engine and CLI; no per-repo migration.
- Move the existing "runs on the host's Node.js" bullet's reference here or link to it from "Distribution".

**New "Exit codes" section:**

- "version skew refused": a write to a tier ahead of the CLI without `--force`.
- "target unavailable": no repo, unconfigured repo, unresolved or missing Claude config dir — one code for every tier.
- "Node.js too old" uses the generic error code.
- `--force` bypasses registry validation and version skew; it never bypasses "target unavailable".
- Numbers/identifiers: detailed in Command Surface.

## Files to Change

- `docs/agents/specs/arcanum-cli.md` — rewrite "Version skew"; add "Runtime" and "Exit codes" sections; add one entry to "Alternatives considered".
