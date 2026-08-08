# Issue: Harden shared origin-resolution libs to stop trusting ambient shell cwd for resolving the target GitHub repo

## Description
`_lib/origin.sh` and `_lib/github_issue.sh` resolve which GitHub repo to operate on via `git remote get-url origin` against whatever the current shell's working directory happens to be, rather than the target project repo a skill is actually operating on. `discuss-issue/scripts/github.sh` and `enhance-issue/scripts/github.sh` are thin wrappers around `_lib/github_issue.sh`, so every skill sourcing either lib inherits the same ambient-cwd resolution — confirmed callers: `discuss-issue`, `enhance-issue`, `auto-fix-issue`, `auto-new-issue`, `auto-fix-all`, `monitor-issues`, `auto-monitor-pr`, `auto-monitor-issue-pr`, `init-claude` (11 scripts total).

## Problem
This caused a real incident: while running `/discuss-issue #4` in the `kerghan` repo, the agent's shell cwd was accidentally inside `~/.claude-darthjee/skills/discuss-issue/scripts` — itself a checkout of `darthjee/arcanum`. `github.sh` silently resolved `origin` from that cwd, and the update landed on `darthjee/arcanum#4` instead of `darthjee/kerghan#4`, overwriting its title/body and adding a `Refined` label that had to be manually reverted.

The incident wasn't a wrong top-level invocation — the agent had correctly been working in `kerghan`, but a nested step `cd`'d into the skill's own scripts directory to run `github.sh` directly. So the risk isn't "which repo did the run start in" — it's that any bash invocation downstream in a skill's flow, including inside a spawned subagent, can change cwd, and the scripts have no way to notice the ground shifted under them.

## Expected Behavior
Once a skill's flow resolves its target repo at the start of a run, every subsequent script call and spawned subagent keeps operating against that same resolved repo for the rest of the run — regardless of what the shell's ambient cwd drifts to along the way.

## Solution
There is no legitimate multi-repo case — every dependent skill already assumes one fixed target repo for its whole run. So the fix is "resolve once, trust it forever after," not "support an explicit repo per call":

- Resolve the repo path once, at the very top of each skill's flow, from the invocation-time cwd, the one moment it can be trusted.
- Thread that resolved path explicitly as a **required positional argument** through every subsequent script call and every spawned-subagent prompt for the rest of that skill's run — no `--repo-path` flag with a cwd fallback, no env var. A missing repo-path argument is a hard usage error, not a silent fallback to ambient cwd. This makes the old failure mode structurally impossible rather than just discouraged.
- `_lib/origin.sh` and `_lib/github_issue.sh`, and all 11 dependent scripts/skills, stop re-deriving the repo from ambient cwd at any point after that first resolution — e.g. via `git -C <repo_path> remote get-url origin` fed from the threaded-through path, rather than a bare `git remote get-url origin`.
- Add a standalone regression shell script (under `_lib/` or a new `scripts/` test dir) that `cd`s somewhere unrelated, calls the resolver with an explicit repo path, and asserts it still resolves the right repo — a permanent, repeatable check for this exact bug. See `docs/agents/todo.md` for the broader follow-up (this repo has no test framework yet for its shell scripts in general; this one regression script is scoped narrowly to this issue, not a stand-in for that larger effort).

## Acceptance Criteria
- [ ] `_lib/origin.sh` and `_lib/github_issue.sh` no longer rely on ambient shell cwd to resolve `origin` — every command takes the repo path as a required positional argument; calling without it is a hard usage error.
- [ ] All 11 dependent scripts/skills (`discuss-issue`, `enhance-issue`, `auto-fix-issue`, `auto-new-issue`, `auto-fix-all`, `monitor-issues`, `auto-monitor-pr`, `auto-monitor-issue-pr`, `init-claude`) are updated to resolve the repo path once at the top of their flow and pass it through explicitly, including to spawned subagents, rather than letting downstream steps re-derive it.
- [ ] A regression shell script exists that reproduces the original failure mode (cwd changed mid-flow to an unrelated git checkout, e.g. another skill's own scripts directory) and asserts it no longer causes updates to land on the wrong repo.
- [ ] SKILL.md docs updated wherever they describe the old cwd-based resolution behavior.

## Benefits
Eliminates a class of silent wrong-repo writes across every skill in this project that talks to GitHub issues — protecting against accidental data corruption like the `arcanum#4` incident, without relying on engineers or agents remembering to `cd` carefully at every step.
