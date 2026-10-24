# Plan: Remove the arcanum CLI spec docs

Issue: [786-remove-the-arcanum-cli-spec-docs.md](../../issues/786-remove-the-arcanum-cli-spec-docs.md)

## Overview

#785 promoted the arcanum CLI spec into the architecture docs, so the spec can go. The coordinator deletes `docs/agents/specs/arcanum-cli.md` and `docs/agents/specs/arcanum-cli/` and drops the spec's row from `docs/agents/specs.md`. Each owner repoints the code comments that still cite the spec to the matching architecture section. Only comment text changes; there are no code changes.

## Agents involved

- [client](client.md): every comment under `cli/`
- [shared](shared.md): `shared/lib/config/KeyRegistry.js`, `shared/lib/config/AgentEmail.js`
- [node](node.md): the three `core/spec` files citing the key registry part
- [infra](infra.md): `scripts/publish_cli_package.sh`

## Shared contracts

All paths below are relative to `docs/agents/`. Use the same form the comments use today: a repo-relative `docs/agents/architecture/<file>.md#<anchor>`.

| Spec reference | New target |
| --- | --- |
| `specs/arcanum-cli.md#runtime` | `architecture/arcanum-cli.md#runtime-path` |
| `specs/arcanum-cli.md` (targeting) | `architecture/arcanum-cli.md#targeting` |
| `specs/arcanum-cli.md` (version skew) | `architecture/arcanum-cli.md#version-skew` |
| `command-surface.md#syntax-rules` | `architecture/arcanum-cli.md#syntax-rules` |
| `command-surface.md#value-parsing` | `architecture/arcanum-cli.md#value-parsing` |
| `command-surface.md#missing-and-malformed-tier-files` | `architecture/arcanum-cli.md#missing-and-malformed-tier-files` |
| `command-surface.md#--repo-normalization` | `architecture/arcanum-cli.md#repo` |
| `command-surface.md` (exit codes) | `architecture/arcanum-cli.md#exit-codes` |
| `command-surface.md` (refusal order, used by `writeTier.js`) | `architecture/arcanum-cli.md#refusal-order` |
| `command-surface.md` (output sections) | `architecture/arcanum-cli.md#output` |
| `shortcuts-and-setup.md` (shortcuts in general) | `architecture/arcanum-cli.md#shortcuts` |
| `shortcuts-and-setup.md#shortcut-set` | `architecture/arcanum-cli.md#shortcuts` |
| `shortcuts-and-setup.md` (design rules, boolean tokens) | `architecture/arcanum-cli.md#design-rules` |
| `shortcuts-and-setup.md` (output sections) | `architecture/arcanum-cli.md#shortcut-output` |
| `shortcuts-and-setup.md` (`agents email`) | `architecture/arcanum-cli.md#agents-email` |
| `shortcuts-and-setup.md` (`ignore-checks`) | `architecture/arcanum-cli.md#ignore-checks` |
| `shortcuts-and-setup.md` (wizard) | `architecture/arcanum-cli.md#setup-wizard`, or a subsection: `#terminal`, `#per-setting-flow`, `#errors-interrupts-and-summary`, `#how-it-is-built` |
| `key-registry.md` | `architecture/shared-state-and-configuration.md#the-key-registry` |
| `key-registry.md` ("Enforcing 'a new key means a registry entry'", "How arcanum's own code consumes the registry") | `architecture/shared-state-and-configuration.md#keeping-it-in-sync` |
| `shared-config-logic.md#configerror` | `architecture/shared-lib.md#configerror` |
| `shared-config-logic.md#bundle-at-build-time-with-esbuild` | `architecture/shared-lib.md#the-cli-bundle` |
| `shared-config-logic.md` (import lint rule) | `architecture/shared-lib.md#import-boundary` |
| `shared-config-logic.md` (agent-email helper) | `architecture/shared-lib.md#configchainreadwithsource-and-agentemail` |
| `packaging-and-release.md#build-output` | `architecture/install-and-release.md#build-output` |
| `packaging-and-release.md#embedded-migration-version-list` | `architecture/install-and-release.md#build-output` (that section holds the list) |
| `packaging-and-release.md#release` | `architecture/install-and-release.md#job-and-script` |

Before writing a comment, check the anchor against the target file's actual heading. A GitHub slug lowercases the heading, drops backticks and punctuation such as `#` and `'`, and turns spaces into `-`. If a section is named differently from what the comment describes, pick the heading whose content matches and keep the comment's wording accurate. When a comment says "spec", e.g. "in the spec's precedence order", reword it so it no longer refers to a spec.

## Architect work (done by the coordinator, not dispatched)

### Step 1 — Delete the spec
`git rm -r docs/agents/specs/arcanum-cli.md docs/agents/specs/arcanum-cli/`.

### Step 2 — Drop the specs index row
Remove the `[Arcanum CLI](specs/arcanum-cli.md)` row from the table in `docs/agents/specs.md`. Keep its intro and the Shell Engine Removal row unchanged.

### Step 3 — Sweep and verify
After the specialists finish, run `git grep -n "specs/arcanum-cli" -- ':!docs/agents/issues' ':!docs/agents/plans'`. It must print nothing. Also run `git grep -n "\.\./arcanum-cli\.md\|arcanum-cli/" -- docs` and check that no markdown file outside the issues and plans folders links into the deleted folder. Fix any markdown link it turns up yourself. `cli/coverage/` is gitignored and is not part of the check.

## Files to Change (architect)
- `docs/agents/specs/arcanum-cli.md`: deleted
- `docs/agents/specs/arcanum-cli/` (5 files): deleted
- `docs/agents/specs.md`: drop the Arcanum CLI row

## Notes
- Historical `docs/agents/issues/` and `docs/agents/plans/` files keep their old links on purpose.
- `docs/agents/specs/shell-engine-removal.md` is a different spec and stays.
- No architecture doc content changes are expected. #785 already repointed every markdown link.
