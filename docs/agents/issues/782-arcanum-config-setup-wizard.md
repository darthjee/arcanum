# Issue: arcanum config setup wizard

## Description
Part of epic #767 (Arcanum user-facing CLI for configuration). Implement `arcanum config setup [<section>...]`, the interactive onboarding wizard, exactly as specified in [`docs/agents/specs/arcanum-cli/shortcuts-and-setup.md` → `arcanum config setup` wizard](../specs/arcanum-cli/shortcuts-and-setup.md#arcanum-config-setup-wizard).

Its dependencies are merged: the generic `config` commands (#780), the shortcuts (#781) and `RepoConfigWriter#update` (#841). The registry already carries the `setup` fields, and `KeyRegistry` already validates them against the canonical section list.

Owner: `client`.

## Problem
A new user has to learn dotted keys, tiers and a dozen shortcuts before arcanum is configured. There is no guided path through the handful of settings that every new user has to decide: agent emails, engine mode, safe branch, merge-body mode, next-step auto toggles and ignored CI checks.

## Expected Behavior
- **Sections and order.** `identity` → `engine` → `git` → `flow` → `ci`. The wizard asks exactly the registry entries that carry `setup`, ordered by section, then by `setup.order`.
  - Wildcard entries expand to their `setup.instances`.
  - `git.agents.<agent>` instead expands to the repo's `.claude/agents/*.md`, behind a `customise per-agent emails? [y/N]` opt-in. Each of those prompts shows what the `git.email` pattern resolves to for that agent.
- **Subset.** `arcanum config setup identity flow` runs only those sections, in canonical order, ignoring duplicates. An unknown section is exit `2` and lists the valid ones.
- **Per setting:**
  1. Show the key, its description, its current resolved value and its source tier.
  2. Ask for the new value. Enter keeps it and asks nothing more; `-` unsets the key.
  3. Ask for the tier, offering only the registry's allowed tiers and defaulting to the shortcut's default tier. Single-tier keys skip this question.
  4. Confirm with `[Y/n]`. When a higher-precedence tier shadows the chosen one, the confirmation adds `note: <tier> still overrides this (value: …)`.
  5. Write immediately, through the same code path as `config set`/`unset`, so the lock, skew, malformed-file and validation rules all apply.
- **Input.**
  - Invalid values re-prompt with the error instead of exiting `3`.
  - Booleans accept `y`/`n`, `on`/`off` and `true`/`false`, and are stored as JSON booleans.
  - Enums show their choices inline.
  - The `ci` array shows the current list, then loops over `[a]dd / [r]emove / [d]one`. Each add or remove follows the `ignore-checks` rules and is confirmed and written individually.
- **Targeting.**
  - Outside a repo, or in an unconfigured repo (which adds a `/init-claude` hint), the wizard skips with a one-line note every item whose default or only tier is `repo` or `local`, the per-agent overrides and the `ci` section.
  - If nothing is left to ask, it prints the notes and exits `4`.
- **TTY.**
  - The wizard needs both stdin and stderr to be TTYs. Prompts go to stderr, and stdout carries only results.
  - Without a TTY it exits `2` with `arcanum: config setup needs an interactive terminal` and `hint: use arcanum config set / the shortcuts instead`. There is no `AskUserQuestion` fallback.
  - `--json` is exit `2`.
- **Interrupts and errors.**
  - Ctrl-C and EOF exit `130` and keep the settings already written. No lock is held while waiting for input.
  - A write error (lock timeout, skew, malformed file, I/O) marks that setting failed and continues. The final exit code is the first error's code, or `0`.
- **Summary.** Every exit path, including Ctrl-C and EOF, prints a summary to stderr: written (key, tier, old → new), kept, failed (with reason) and not reached.

## Solution
- **Code.** Add a `setup` command under `cli/lib/commands/config/`, wired into `main.js`/`help.js`. It reuses the existing generic write path (`writeTier.js`, `values.js`, `target.js`) and the shortcuts' default-tier table and `ignore-checks` add/remove logic (`RepoConfigWriter#update`), rather than duplicating them.
- **Prompts.** Isolate them behind a small injectable prompter (a stdin/stderr line reader), so specs can drive it through a scripted or pseudo-TTY input stream.
- **Specs.** Cover the spec's [Testing](../specs/arcanum-cli/shortcuts-and-setup.md#testing) wizard list:
  - keep, set, unset with `-`, and an invalid value that re-prompts;
  - the tier prompt and the shadowing note;
  - the `ci` add/remove loop and the per-agent opt-in;
  - Ctrl-C mid-run, EOF, and a write failure followed by a later success;
  - no TTY, `--json`, no repo and an unknown section;
  - the summary in each case.
- **Docs.**
  - Add a `setup` section to the end-user guide, `docs/guides/arcanum-cli.md`.
  - Mention it in `cli/README.md` and the `docs/agents/architecture/arcanum-cli.md` architecture doc.

## Benefits
- New users get one guided command that covers every onboarding decision.
- The wizard is registry-driven, so adding a key to it is a `keys.json` edit.
- Writes are confirmed, immediate and atomic, so an interrupted run never loses earlier answers.
