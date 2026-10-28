# Architect Plan: Promote the CLI install spec into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

- Create `docs/agents/architecture/cli-install.md`, titled `# CLI Install`, with a `## Shared rules` section (anchor `#shared-rules`) and a `## Version pinning` section (anchor `#version-pinning`). `client` links to both.
- Link to `arcanum-cli.md#self-update` for the `arcanum self-update` command. Do not copy its content.

## Implementation Steps

### Step 1 — Write `docs/agents/architecture/cli-install.md`

Write a permanent architecture doc from `docs/agents/specs/cli-install.md`, `cli-install/install.md`, `cli-install/update.md` and `cli-install/already-installed.md`.

- **What to keep:** decisions that are still true. Check each one against the code: `arcanum/_lib/install_cli.sh`, `arcanum/install/installer.sh`, `arcanum/update/updater.sh`, `arcanum/update/bootstrap.sh`, `arcanum-update/` and `arcanum/migrations/repos/next/001.sh`. When the spec and the code disagree, the code wins.
- **What to drop:**
  - spec-only framing: Status, Origin, Open points, "Docs the implementation updates";
  - forward-looking wording ("will", "today the client is a separate step").

Suggested sections:

1. **Overview:**
   - Installing or updating arcanum offers `arcanum-cli@<arcanum version>`.
   - The optional client is installed through `npm i -g`.
   - Scope, and what is out of scope: Node install, uninstall, and the installer's refusal on an existing install.
2. **Shared rules** (`## Shared rules`): every rule from the spec's Shared rules list:
   - the prompt;
   - `ARCANUM_SKIP_CLI` and `ARCANUM_ASSUME_YES`;
   - the opt-in `ARCANUM_CLI_PROMPT=chat` / `FALLBACK=chat`;
   - the no-TTY skip and warn-and-continue;
   - the validated version;
   - the exact pin with `--ignore-scripts`;
   - consent only through `--no-confirm`;
   - the bounded `npm view`, honoring the npm config, and forks;
   - skipped paths cost nothing.
   
   Also state which of these rules `self-update` overrides (it ignores `ARCANUM_SKIP_CLI`, has no prompt, and fails instead of warning), and link to [`arcanum self-update`](arcanum-cli.md#self-update).
3. **Version pinning** (`## Version pinning`): lockstep with arcanum, an unpublished version, and `self-update` targeting `latest`.
4. **The shared script:** the contract of `arcanum/_lib/install_cli.sh`:
   - its arguments and `--no-confirm`;
   - its env vars;
   - stderr-only output prefixed `arcanum-cli:`;
   - its exit codes `0`, `1` and `4`, and `CLI_VERSION=`;
   - why it is plain bash. Link to [Script Engine](script-engine.md), which records the exception.
5. **An already-installed client:** from `already-installed.md`:
   - the installed version and detection through `npm ls`;
   - version comparison;
   - a linked dev checkout;
   - an unreadable install;
   - a foreign `arcanum` on `PATH`;
   - how each caller behaves;
   - edge cases.
6. **Callers:**
   - the installer;
   - the zip updater;
   - the `git clone` path in `bootstrap.sh`, run from the checked-out tree;
   - `/arcanum-update`, with the opt-in `FALLBACK=chat` and its `AskUserQuestion` resume with `--no-confirm`;
   - the global migration `arcanum/migrations/repos/next/001.sh`: `applies_to: "global"`, skippable, `[R]un` is the consent.
   
   Always cite the migration by that full path ([Per-Repo Migrations](per-repo-migrations.md) "Referencing pending migrations"), so `scripts/bump-version.sh` rewrites it.
7. **Outcomes:** copy the Outcomes tables of `install.md`, `update.md` and `already-installed.md` with their exact wording. Keep the column layout. Merge them under one heading per source.
8. **Backward compatibility:** zip installs, the first-update gap for `git clone` installs, and older `/arcanum-update` sessions.
9. **Testing:** a short summary of where the behavior is tested: `arcanum/_lib/test_install_cli.sh`, `arcanum/install/test_installer.sh`, `arcanum/update/test_updater.sh`, `arcanum/update/test_update_bootstrap.sh`, and the `arcanum-update` and migration tests if any. Check which ones exist.
10. **Alternatives considered:** the rejected alternatives from the index and the parts that still explain the design. Drop the duplicates.
11. **See also:** [Install & Release Pipeline](install-and-release.md), [Arcanum CLI](arcanum-cli.md), [Per-Repo Migrations](per-repo-migrations.md), and the end-user [guide](../../guides/arcanum-cli.md) plus `README.md`'s Installation and Updating sections.

The new doc must not link into `docs/agents/specs/cli-install*`.

### Step 2 — Repoint links and index the doc

- **`docs/agents/architecture/install-and-release.md`:**
  - In `### Install` (npm package), link the "installer and updater offer it" bullet to [CLI Install](cli-install.md).
  - In the global-migration bullet, replace the link to `../specs/cli-install/update.md#global-migration-next001` with `cli-install.md`'s migration caller section.
  - In `## Update`, add one sentence after the bootstrap/updater description saying that both update paths (zip and `git clone`) run the client step. Link to the new doc.
  - `/arcanum-update` likewise: one sentence about the opt-in `FALLBACK=chat`, linking to the new doc.
- **`docs/agents/architecture/script-engine.md`:** in the `install_cli.sh` plain-bash exception, replace `See [CLI Install](../specs/cli-install.md)` with a link to `cli-install.md`.
- **`docs/agents/architecture/per-repo-migrations.md`:** no change unless it already lists example `global` migrations. Only then, add one line for `arcanum/migrations/repos/next/001.sh` (full path).
- **`docs/agents/architecture.md`:** add a row for [CLI Install](architecture/cli-install.md) right after Install & Release Pipeline. Its summary covers the shared `arcanum-cli` client step, its rules and outcomes, and how the installer, updater, `/arcanum-update` and the global migration call it.
- **`docs/agents/specs.md`:**
  - Set the CLI Install row's status to `Implemented; promoted to [CLI Install](architecture/cli-install.md) (removal: #875)`.
  - Keep the row, because #875 removes it.
- **Final check:** run `grep -rn "specs/cli-install" docs/agents/architecture docs/agents/architecture.md`. It must return nothing once `client`'s work is in. Hits in code comments, issues, plans and `specs.md` itself are expected and out of scope.

## Files to Change

- `docs/agents/architecture/cli-install.md` — new: the client-step architecture doc.
- `docs/agents/architecture/install-and-release.md` — links to the new doc. Replace the spec link.
- `docs/agents/architecture/script-engine.md` — repoint the spec link.
- `docs/agents/architecture/per-repo-migrations.md` — only if it already lists example global migrations.
- `docs/agents/architecture.md` — the index row.
- `docs/agents/specs.md` — the CLI Install status.

## CI Checks

- Markdown lint uses the repo's `.markdownlint.json` / `.markdownlintignore`. Keep tables and lists consistent with the existing docs.

## Notes

- Do not touch `docs/agents/specs/cli-install*` or the code comments that cite them. Both belong to #875.
- Don't paraphrase the Outcomes wording. Tests assert those strings, and the doc becomes their source of truth.
- `README.md` and `docs/guides/arcanum-cli.md` were updated in #873. Link to them; don't duplicate them.
