# Harden discuss-issue and enhance-issue's github.sh to stop trusting ambient shell cwd for resolving the target GitHub repo

## Context

`discuss-issue/scripts/github.sh` (and `enhance-issue`'s copy) determine which GitHub repo to operate on by running `git remote get-url origin` against whatever the *current shell* working directory happens to be, rather than the target project repo the skill is actually meant to operate on.

This caused a real incident: while running `/discuss-issue #4` in the `kerghan` repo, the agent's shell cwd was accidentally inside `~/.claude-darthjee/skills/discuss-issue/scripts` — which is itself a checkout of `darthjee/arcanum`. `github.sh` silently resolved `origin` from that cwd and the update landed on `darthjee/arcanum#4` instead of `darthjee/kerghan#4`, overwriting its title, body, and adding a `Refined` label that had to be manually reverted.

## What needs to be done

Have `discuss-issue/scripts/github.sh` and `enhance-issue`'s equivalent script resolve the target repo explicitly instead of relying on ambient shell cwd. For example: accept/require an explicit repo path argument and use `git -C <repo_path> remote get-url origin`, or otherwise have the calling skill pass the resolved repo unambiguously to the script.

## Acceptance criteria

- [ ] `discuss-issue/scripts/github.sh` no longer relies on the ambient shell cwd to resolve `origin` — it is told explicitly which repo to target.
- [ ] `enhance-issue`'s equivalent script gets the same fix.
- [ ] A regression case (shell cwd inside an unrelated git checkout, e.g. another skill's own scripts directory) no longer causes updates to land on the wrong repo.
- [ ] SKILL.md docs updated if they describe the cwd-based resolution behavior.
