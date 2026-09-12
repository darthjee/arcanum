# Plan: monitor_pr.sh REPO_REF includes SSH host, breaking gh api REST calls and silently reporting pending

Issue: [453_monitor-pr-sh-repo-ref-includes-ssh-host--breaking-gh-api-rest-calls-and-silently-reporting-pending.md](../issues/453-monitor-pr-sh-repo-ref-includes-ssh-host--breaking-gh-api-rest-calls-and-silently-reporting-pending.md)

## Overview

`auto-monitor-pr/scripts/monitor_pr_shell.sh` builds a raw `gh api repos/.../pulls/.../comments` REST path from `get_repo_ref`'s domain-qualified value, which 404s under an SSH-proxy-style origin (e.g. `ssh.github.com`) and is silently swallowed into an always-`pending` result. The fix reuses the already-existing `get_repo_path` helper in `arcanum/_lib/origin.sh` (already proven correct in `wait_ci_shell.sh`) for that one call site, logs REST failures to stderr instead of swallowing them silently, and adds the missing test coverage for the SSH-proxy-style origin shape that let this bug go unnoticed.

See [scripter.md](scripter.md) for the full plan.
