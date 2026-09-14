# Scripter Plan: Fix 6 standalone SC2034 findings across scripts and libs

Main plan: [plan.md](plan.md)

## Overview

The issue's own investigation (grepping each variable across its own file and every script that sources it) already settled unused-vs-consumed for all 6 locations — each step below is a single, already-verified fix rather than an open investigation.

## Steps

- [01 — Keep NAMESPACE in config_common.sh, suppress with consumer comment](scripter/01-keep-namespace-config-common.md)
- [02 — Remove unused ID in resolve_pr_number.sh](scripter/02-remove-id-resolve-pr-number.md)
- [03 — Keep REPO in run_update_common.sh, suppress with consumer comment](scripter/03-keep-repo-run-update-common.md)
- [04 — Keep DEFAULT_LABEL_CONFIG_PATH in label_config.sh, suppress with consumer comment](scripter/04-keep-default-label-config-path.md)
- [05 — Keep repo_path param in merge_body.sh, suppress with convention comment](scripter/05-keep-repo-path-merge-body.md)
- [06 — Remove unused skip local in label_config.sh](scripter/06-remove-skip-label-config-remove.md)

## Notes

- After each fix, verify with `shellcheck <file>` locally (0.11.0 available) that the specific SC2034 finding is gone and no new finding was introduced.
- No CI job runs ShellCheck locally in this repo (`.circleci/config.yml` only has `build-and-release`/`test`/`checks`, none of which lint shell scripts) — these findings come from Codacy's external analysis, so there is no `make`/`yarn` command to wire into a `## CI Checks` section here. Re-running Codacy (or `shellcheck` directly) on the 6 files is the only verification available, per the issue's acceptance criteria.
- Keep every fix behavior-neutral: only add/remove the flagged variable and its suppression comment, nothing else in these files.
