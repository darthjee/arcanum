# Plan: Fix SC2016 cluster: verify single-quoted expressions across 6 findings in 5 scripts

Issue: [483-fix-sc2016-cluster-verify-single-quoted-expressions-across-7-findings-in-6-scripts.md](../../issues/483-fix-sc2016-cluster-verify-single-quoted-expressions-across-7-findings-in-6-scripts.md)

## Overview
Codacy's ShellCheck flags 6 SC2016 findings across 5 files, all of the same two shapes: a `gh api graphql -f query='...$var...'` call where `$var` is a GraphQL variable placeholder resolved server-side via `-F` (not a shell variable), a `printf '...%s...'` format string whose literal text must not be shell-expanded, and a `su ... -c '...$0...$@...'` call where the tokens are meant to expand inside the `su`'d subshell. All 6 are expected to be confirmed-safe false positives; each gets a documented `# shellcheck disable=SC2016` suppression rather than a quoting change, unless verification turns up a genuine bug.

## Agents involved

- [scripter](scripter.md)
- [infra](infra.md)

## Shared contracts

None. Each finding is an independent single-line annotation in its own file; no interface, data shape, or shared config crosses the boundary between `scripter`'s and `infra`'s work.
