# Issue: Remove the arcanum CLI spec docs

Part of epic #767 (Arcanum user-facing CLI for configuration). See the epic for the full design decisions. This is the epic's last sub-issue.

#785 promoted the arcanum CLI spec into the architecture docs:

- `docs/agents/architecture/arcanum-cli.md`
- `shared-state-and-configuration.md` (the key registry)
- `shared-lib.md` (config services, the CLI bundle, CI coupling)
- `install-and-release.md` (the `arcanum-cli` npm package)
- `agent-roster-and-delegation.md`

The spec files are now redundant. This issue removes them and repoints every remaining reference to them. It follows the same pattern as the Docker spec removal (#732, from epic #765).

`docs/agents/specs/arcanum-cli.md` and its five parts under `docs/agents/specs/arcanum-cli/` duplicate content that now lives in the architecture docs, so the two copies can drift. `docs/agents/specs.md` still lists the CLI spec as "Proposed", even though the CLI has shipped.

Unlike the Docker spec, this spec is cited by about 40 code comments. Deleting it leaves those comments pointing at paths that no longer exist:

- `cli/lib/**`, `cli/spec/lib/values_spec.js`, `cli/bin/arcanum`, `cli/scripts/build.mjs` and `cli/eslint.config.mjs`;
- `shared/lib/config/KeyRegistry.js` and `shared/lib/config/AgentEmail.js`;
- `core/spec/support/utils/shellConfigKeys.js`, `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js` and `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`;
- `scripts/publish_cli_package.sh`.

- `docs/agents/specs/arcanum-cli.md` and `docs/agents/specs/arcanum-cli/` no longer exist.
- `docs/agents/specs.md` no longer has the Arcanum CLI row. Its intro and the Shell Engine Removal row are unchanged.
- No file outside the historical `docs/agents/issues/` and `docs/agents/plans/` folders references `specs/arcanum-cli`. The check is `grep -rn "specs/arcanum-cli" . --exclude-dir=node_modules --exclude-dir=.git`, excluding those two folders, and it returns nothing.
- Each repointed comment names the architecture section that now holds the same content, so the comment's meaning is unchanged.
- Code is unchanged apart from comments. Lint and specs still pass in `cli/`, `shared/` and `core/`.

### Architect

- `git rm -r docs/agents/specs/arcanum-cli.md docs/agents/specs/arcanum-cli/`.
- Remove the Arcanum CLI row from `docs/agents/specs.md`.
- Sweep the markdown docs for any remaining `specs/arcanum-cli` links. None are known today, because #785 already repointed them.
- Run the final grep check across the repo.

### Repointing code comments, by owner

Each owner repoints the comments in its own files. Only the comment text changes.

| Files | Owner |
| --- | --- |
| `cli/**` (`lib/`, `spec/`, `bin/arcanum`, `scripts/build.mjs`, `eslint.config.mjs`) | `client` |
| `shared/lib/config/KeyRegistry.js`, `shared/lib/config/AgentEmail.js` | `shared` |
| `core/spec/support/utils/shellConfigKeys.js`, `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js`, `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` | `node` |
| `scripts/publish_cli_package.sh` | `infra` |

Mapping from the spec to the architecture docs (paths relative to `docs/agents/`). Point each comment at the nearest matching anchor:

| Spec reference | New target |
| --- | --- |
| `specs/arcanum-cli.md` (Runtime, Targeting, Version skew) | `architecture/arcanum-cli.md` (`#runtime-path`, `#targeting`, `#version-skew`) |
| `specs/arcanum-cli/command-surface.md` (syntax rules, value parsing, missing/malformed tier files, `--repo` normalization, exit codes, output) | `architecture/arcanum-cli.md` (`#syntax-rules`, `#value-parsing`, `#missing-and-malformed-tier-files`, `#repo`, `#exit-codes`, `#output`) |
| `specs/arcanum-cli/shortcuts-and-setup.md` (shortcut set, per-setting flow, wizard) | `architecture/arcanum-cli.md` (`#shortcuts`, `#per-setting-flow`, `#setup-wizard`, etc.) |
| `specs/arcanum-cli/key-registry.md` (incl. "Enforcing 'a new key …'") | `architecture/shared-state-and-configuration.md#the-key-registry` (`#keeping-it-in-sync` for the enforcement and drift specs) |
| `specs/arcanum-cli/shared-config-logic.md` (`ConfigError`, esbuild bundling, the agent-email helper, the import lint rule) | `architecture/shared-lib.md` (`#configerror`, `#the-cli-bundle`, `#configchainreadwithsource-and-agentemail`, `#import-boundary`) |
| `specs/arcanum-cli/packaging-and-release.md` (build output, embedded migration-version list, release) | `architecture/install-and-release.md` (`#build-output`, `#job-and-script`, etc.) |

The agent editing each comment verifies the anchor against the actual headings, since GitHub anchor slugs drop backticks and punctuation.

### Out of scope

- Historical `docs/agents/issues/` and `docs/agents/plans/` files are left untouched.
- `docs/agents/specs/shell-engine-removal.md` is not part of this spec and is left untouched.
- No content changes to the architecture docs, beyond fixing a broken link if the sweep finds one.

- One source of truth for the CLI's design: the architecture docs.
- No dead spec paths in code comments, so a reader following a comment lands on current docs.
- Closes epic #767.
