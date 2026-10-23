# Plan: Promote the arcanum CLI spec into architecture docs

Issue: [785-promote-the-arcanum-cli-spec-into-architecture-docs.md](../../issues/785-promote-the-arcanum-cli-spec-into-architecture-docs.md)

## Overview

This is documentation only. It moves the design in `docs/agents/specs/arcanum-cli.md` and `docs/agents/specs/arcanum-cli/*.md` into permanent architecture docs, written as what was actually built. Where the spec and the code disagree, the code wins. The spec files are not touched; #786 deletes them.

`client` owns `docs/agents/architecture/arcanum-cli.md` on the agent roster, so it writes that doc. See [client.md](client.md) for the full plan. The other docs are `architect`'s, listed below.

## Architect work (done by the coordinator, not dispatched)

The planner excludes the architect from the agent split, so the coordinator makes these edits itself. Check each claim against the code before writing it: `shared/lib/`, `shared/lib/config/keys.json`, `cli/scripts/build.mjs`, `cli/package.json`, `scripts/publish_cli_package.sh`, `scripts/bump-version.sh`, `.circleci/config.yml`, `.claude/agents/`, and `.claude/configuration/arcanum-repo-config.json`.

1. **`docs/agents/architecture/shared-state-and-configuration.md`**, the "The key registry" section, from [Key Registry](../../specs/arcanum-cli/key-registry.md):
   - write as current state: entry shape (fields, types, `tiers`, `default`, `setup`, `instances`, `format_version`), location, wildcard matching (a literal entry beats a wildcard), validation, consumers, and keeping it in sync (the defaults drift spec, the `ARCANUM_STRICT_CONFIG_KEYS` guard, the static scan of shell config calls);
   - keep the rule that a new config key means a registry entry, with the `keys.json` ownership exception;
   - don't copy the seed key list; `keys.json` is the source of truth;
   - drop the link to the spec part;
   - add a short "Future work" (per-key skew granularity: `since` / `moved_in` / `removed_in`, and why no `format_version` bump is needed; runtime registry consumption) and a condensed "Alternatives considered".
2. **`docs/agents/architecture/shared-lib.md`**, from [Shared Config Logic](../../specs/arcanum-cli/shared-config-logic.md). Add only what isn't already there:
   - `ConfigError` (codes and adoption in `RepoConfigWriter`, `Lock` and the strict-keys guard);
   - the lock protocol (atomic acquire, owner-checked release, stale-lock detection, the CLI's bounded wait, #807);
   - `RepoPath#toplevel`;
   - `AgentEmail` and `ConfigChain#readWithSource`;
   - the `esbuild` bundle and its metafile check, linked to the existing Import boundary table rather than repeated;
   - malformed files staying the CLI's concern;
   - CI coupling (no path filters on the `cli` / `shared` jobs).

   Also fold the spec's rejected alternatives into the existing "Alternatives considered" section, and replace the See also line ("still a spec until #785 and #786 promote it") with a link to [Arcanum CLI](../../architecture/arcanum-cli.md).
3. **`docs/agents/architecture/install-and-release.md`**, the "npm package (arcanum-cli)" section, from [Packaging and Release](../../specs/arcanum-cli/packaging-and-release.md):
   - replace the "The design is in …" pointer;
   - add what the section lacks:
     - code layout (`cli/` kept out of the release zip, with the `core/spec` check);
     - the `cli/package.json` shape (no runtime dependencies, no install scripts, `bin`, `files`, `engines`, `publishConfig`);
     - the build output and the embedded per-scope migration-version list;
     - install;
     - version lockstep (`scripts/bump-version.sh` and the version spec);
     - provenance;
     - dist-tags (only `latest`);
     - local tooling (`make cli-publish-dry-run`);
     - supply chain;
   - keep the existing job/script, trusted-publishing and failure sections, merging rather than duplicating;
   - add a "Future work" line for the `next` dist-tag, and a condensed "Alternatives considered".
4. **`docs/agents/architecture/agent-roster-and-delegation.md`**: add what is missing from the spec's Ownership section:
   - the CLI cross-boundary rules (a shared-surface PR keeps the CLI specs green in the same PR, and the planner splits such plans across `shared` and the consumers' owners; `client` never edits `core/`, `node` never edits `cli/`);
   - `client`'s commit identity (it reuses the `+frontend` alias, shared with `skill-writer`);
   - that `client` has no `Agent` tool and delegates through `architect`.

   The per-piece table is not copied. Every piece is already covered by the roster's folder scopes.
5. **`docs/agents/architecture.md`**: update the index summaries for Arcanum CLI (now the contract as well as the internals), Shared State & Configuration (the key registry), Install & Release (the npm package) and Shared Lib, if their scope changed.
6. **Links**:
   - `.claude/agents/client.md`: line 44 points to the agent roster and the CLI architecture doc instead of the spec; delete the "Until the CLI's permanent architecture doc exists (#785)…" bullet (line 57), or reword it to point to `docs/agents/architecture/arcanum-cli.md`.
   - `docs/agents/folder-structure.md`: the `cli/` row says "See `docs/agents/architecture/arcanum-cli.md`".
   - `cli/README.md`: in See also, replace the spec bullet with `https://github.com/darthjee/arcanum/blob/main/docs/agents/architecture/arcanum-cli.md` (absolute, because the page renders on npmjs.com). This is a one-line link swap in a `client`-owned file, done here to keep the link sweep in one place.
   - Finally, run `grep -rn "specs/arcanum-cli" --include=*.md . | grep -v '^./docs/agents/specs'`. Only `docs/agents/specs.md` and files under `docs/agents/issues/` and `docs/agents/plans/` may still match.

Leave `docs/agents/specs.md`, `docs/agents/specs/arcanum-cli.md` and `docs/agents/specs/arcanum-cli/` alone (#786). Leave the end-user guide `docs/guides/arcanum-cli.md` alone (#784).

## Notes

- `client` and the architect touch different files, so they can work in parallel. The only overlap is the link targets: everything links to `docs/agents/architecture/arcanum-cli.md` and its headings, so link to section anchors only after `client` has settled the headings, or link to the doc without an anchor.
