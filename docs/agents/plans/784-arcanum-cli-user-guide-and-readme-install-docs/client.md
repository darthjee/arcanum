# Plan: arcanum CLI user guide and README install docs

Main plan: [plan.md](plan.md)

## Overview
Close the remaining gaps in the two CLI docs `client` owns, and check both against the CLI's actual `--help` output and the specs. This is a documentation-only change.

## Context
- `docs/guides/arcanum-cli.md` already has these sections: Setup, The three tiers, Everyday use, Shortcuts, Setup wizard, Targeting, `--json` and Troubleshooting.
  - Its Shortcuts examples omit `auto-fix-all finish-on-empty-queue`.
  - It never mentions npm provenance.
- `cli/README.md` is the npm package page.
  - It lists `config setup` only in the Commands synopsis; there is no section explaining it.
  - It never mentions provenance.
  - Its links are absolute GitHub URLs because the page renders on npmjs.com, and they must stay that way.
- Since #783, releases are published through npm trusted publishing, which attaches provenance. `npm audit signatures` verifies the installed packages' registry signatures and provenance attestations.

## Implementation Steps

### Step 1 — User guide gaps and accuracy pass
- In `docs/guides/arcanum-cli.md` → Shortcuts, add `arcanum config auto-fix-all finish-on-empty-queue on   # auto-fix-all.finish_on_empty_queue, local` to the example block.
- Under `## Setup`, add one sentence: releases are published with npm provenance, and `npm audit signatures` checks it after install.
- **Accuracy pass:** build the CLI (`cd cli && yarn install && yarn build`) and compare the guide with `node dist/arcanum.mjs config --help`, each subcommand's `--help`, and each shortcut's `--help`. Check every command, shortcut, flag, default tier and exit code, and fix any drift. Use `docs/agents/specs/arcanum-cli/*.md` as the reference when `--help` is terse.

### Step 2 — `cli/README.md` setup section and provenance note
- After the Shortcuts subsections, add `### setup` covering:
  - `arcanum config setup [<section>...]`, with the sections `identity`, `engine`, `git`, `flow` and `ci`, which always run in that order;
  - per setting: the current value and its tier are shown, Enter keeps it, `-` unsets it, a tier is asked only when the key allows more than one, and a `[Y/n]` confirmation precedes the immediate write;
  - it needs an interactive terminal (exit `2` otherwise) and refuses `--json`;
  - Ctrl-C or Ctrl-D exits `130` and keeps what was already written;
  - a link to the user guide's Setup wizard section, as an absolute URL.
- Under `## Install`, add the provenance sentence from Step 1.
- Run the same accuracy pass on the README's Commands, Shortcuts and Exit codes against `--help`.

## Files to Change
- `docs/guides/arcanum-cli.md` — the `finish-on-empty-queue` example, the provenance note and any drift fixes.
- `cli/README.md` — the `### setup` section, the provenance note and any drift fixes.

## CI Checks
- Markdown: `npx markdownlint-cli2` (or the repo's markdownlint command), using `.markdownlint.json`, on the touched files.
- `cli`: `yarn build && yarn lint && yarn test` (CI jobs: `cli`, `cli-node-floor`). No code changes, but the packaging specs read `cli/README.md`, so run them anyway.

## Notes
- Do not touch the root `README.md` or `docs/guides/arcanum-*-config.md`. The coordinator handles those (see [plan.md](plan.md)).
- Keep `cli/README.md`'s links absolute.
