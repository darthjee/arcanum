# Issue: Promote the arcanum CLI spec into architecture docs

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration).

Every implementation sub-issue of the epic has merged (#775–#784). This issue promotes the design in `docs/agents/specs/arcanum-cli.md` and its five parts under `docs/agents/specs/arcanum-cli/` into permanent architecture docs that describe what was actually built. It follows the same pattern as the Docker engine work (#764). The spec files stay in place; #786 deletes them.

## Problem

The CLI's permanent docs still defer to a spec marked "Proposed. Nothing in this spec is implemented yet":

- `docs/agents/architecture/arcanum-cli.md` covers only the internals. Its intro says the contract (syntax, value parsing, exit codes, output and JSON shapes) is the spec's and "this doc does not repeat it". Its Shortcuts and Setup wizard sections link to the spec for their contracts.
- `install-and-release.md` links to the Packaging and Release part for the npm release design.
- `shared-state-and-configuration.md` links to the Key Registry part for the registry format.
- `shared-lib.md` says the CLI is "still a spec until #785 and #786 promote it".
- `.claude/agents/client.md` says the design lives in the spec until #785 exists.
- `docs/agents/folder-structure.md` (the `cli/` row) and `cli/README.md` (See also) link to the spec.

Once #786 deletes the spec, all of that contract would be lost.

## Expected Behavior

- Everything the spec defines that is still true of the shipped CLI lives in architecture docs, written as the current state rather than as proposals. Any drift between the spec and the code is resolved in favour of the code.
- No architecture doc, agent file, folder-structure row or `cli/README.md` link points at the spec any more, so #786 is left with only the deletion, the `specs.md` entry, and any stragglers.
- The spec files are untouched.

## Solution

The material is spread by topic, and `docs/agents/architecture/` stays flat:

- **`architecture/arcanum-cli.md`** (owner: `client`). This becomes the CLI's full architecture doc, about the size of `docker-engine.md`. It keeps today's internals sections, and its intro no longer defers to the spec. It adds the contract:
  - from the spec index: goal and distribution, the relationship to `core/bin/arcanum`, targeting (`CLAUDE_CONFIG_DIR`, `--claude-config-dir`, `--repo <path>`), `config info`, version skew, the runtime Node floor and the exit codes;
  - from Command Surface: namespace, generic commands, syntax rules, keys, value parsing, `--force` scope, `--repo` normalization, missing or malformed tier files, lock contention, meta commands, global flags, output, JSON output, error messages and edge cases;
  - from Shortcuts and Setup: the shortcut set and its design rules and output, `agents email`, `ignore-checks`, and the `setup` wizard (coverage and order, registry-driven, sections and targets, the TTY requirement, the per-setting flow, input handling, interrupts and errors).
- **`architecture/shared-state-and-configuration.md`** (owner: `architect`). This gets a key-registry section from the Key Registry part: entry shape, location, wildcard matching, validation, consumers, keeping it in sync, and the "a new key means a registry entry" rule. The seed key list is not copied, since `keys.json` is the source of truth.
- **`architecture/shared-lib.md`** (owner: `architect`). This covers whatever it doesn't already hold from Shared Config Logic: `ConfigError`, the lock (including the CLI's bounded wait), `RepoPath#toplevel`, the shared `AgentEmail` helper, the `esbuild` bundle with its metafile check, and the guardrails (the shared-surface lint rule, malformed files staying the CLI's concern, CI coupling).
- **`architecture/install-and-release.md`** (owner: `architect`). Its npm section gets Packaging and Release in full: code layout, the `cli/package.json` shape, the build output and the embedded migration-version list, install, version lockstep, trusted-publishing authentication, provenance, failure handling, dist-tags, local tooling and supply chain.
- **`architecture/agent-roster-and-delegation.md`** (owner: `architect`). This gets whatever part of the spec's Ownership section is still missing: the cross-boundary rules and the `client` commit identity (the `+frontend` alias).
- **Rejected alternatives** go, condensed, into an "Alternatives considered" section in each receiving doc, as `shared-lib.md` already has.
- **Future work** gets a short section in the doc it belongs to. That covers per-key skew granularity and runtime registry consumption (registry section), the `next` dist-tag (install and release), and the two Command Surface open points, `list --json` defaults and the `--repo` overload (CLI doc). The spec's Status, Origin and per-part Open points / Dependencies boilerplate is dropped.
- **The index and links** (owner: `architect`):
  - update the `docs/agents/architecture.md` index summaries for the changed docs;
  - repoint links to the new homes in `.claude/agents/client.md` (drop the "until #785" line), the `cli/` row of `docs/agents/folder-structure.md`, the See also of `shared-lib.md`, and the See also of `cli/README.md` (an absolute GitHub URL, because the page renders on npmjs.com).
- **Out of scope:**
  - deleting the spec;
  - the `docs/agents/specs.md` entry;
  - end-user guide content (#784).

## Benefits

- The CLI's design is documented as built, in the docs agents already read for each area, rather than in a "Proposed" spec.
- #786 can delete the spec without losing any contract.
