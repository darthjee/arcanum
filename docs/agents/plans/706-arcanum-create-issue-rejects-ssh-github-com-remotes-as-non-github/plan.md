# Plan: arcanum-create-issue rejects ssh.github.com remotes as non-GitHub

Issue: [706-arcanum-create-issue-rejects-ssh-github-com-remotes-as-non-github.md](../../issues/706-arcanum-create-issue-rejects-ssh-github-com-remotes-as-non-github.md)

## Overview
Add a single `ssh.github.com` → `github.com` domain normalization to `core/lib/utils/git/Origin.js`, then use it in `GithubPreflight`, `Origin#resolveWithRef` and `FinishReport`. This work is Node-only.

See [node.md](node.md) for the full plan.
