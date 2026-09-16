# Plan: Fix SC2148 cluster: verify missing-shebang warnings across 20 sourced library scripts

Issue: [485_fix-sc2148-cluster-verify-missing-shebang-warnings-across-20-sourced-library-scripts.md](../../issues/485-fix-sc2148-cluster-verify-missing-shebang-warnings-across-20-sourced-library-scripts.md)

## Overview
Resolves Codacy/ShellCheck SC2148 ("target shell unknown") on 20 library files. 19 are confirmed source-only and get a `# shellcheck shell=bash` directive; `arcanum/_lib/permission_grant.sh` is confirmed direct-executed and gets a real `#!/usr/bin/env bash` shebang instead.

See [scripter.md](scripter.md) for the full plan.
