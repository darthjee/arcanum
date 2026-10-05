# Issue: Auto-next: spec

## Description

Part of #712. Write `docs/agents/specs/skill-auto-next.md`, the spec that every other auto-next sub-issue (#714, #715, #716) builds on. This issue delivers documentation only; nothing executable changes.

## Problem

Auto-next touches a shared script, four skills, init-claude and the migrations. Without one agreed contract (keys, script flags, the Epic rule, chained-versus-nested rules, branch safety), the follow-up sub-issues would each guess and drift apart.

## Expected Behavior

`docs/agents/specs/skill-auto-next.md` exists and defines:
- the `next_step.auto.<skill>` keys (`enhance-issue`, `discuss-issue`, `auto-plan-issue`), read through `config_chain_read <repo> next_step auto.<skill>`, defaulting to `false`, and the exact offer each key skips;
- the `next_step_prompt.sh` contract:
  - `--auto-key <skill>`: prints a one-line `auto-continuing: <cmd> (next_step.auto.<skill>=true)` notice and outputs `CHOICE=yes` and `AUTO=true` with exit 0, without probing `/dev/tty`;
  - `--no-prompt`: outputs `CHOICE` from config alone and never prompts;
  - argument validation still runs first, and the output protocol is unchanged;
- the Epic rule: enhance-issue never auto-chains for an issue labeled `Epic`;
- chained versus nested: chained runs are top level (never `NESTED=true`), and a nested `auto-plan-issue` never chains;
- the init-claude settings step and the opt-in, skippable `repo` and `global` prompted migrations in `arcanum/migrations/repos/next/`, modeled on `0.16.1/001–003`;
- the decisions in the Solution section.

Acceptance criteria:
- [ ] The spec file exists and covers every item above
- [ ] Each open point from #712 has an explicit decision (see Solution)

## Solution

Decisions on the open points from #712:

- **Branch safety before chaining to `/auto-resolve-issue`**: `auto-resolve-issue` bootstraps `issue-<id>` itself through `auto-fix-all/scripts/checkout_from_main.sh`. However, `auto-plan-issue`'s `commit_plan.sh` commits on the current HEAD and does not push.
  - From `plan-issue` and discuss-issue (which pushes the nested plan), the plan is already on `issue-<id>` remotely, so no extra checkout is needed.
  - A top-level `auto-plan-issue` starts from detached `origin/main`, so its plan commit would be left behind. Rule: top-level `auto-plan-issue` auto-chains only when HEAD is the `issue-<id>` branch. Otherwise it does not chain and prints the normal `Next:` line.
- **Chained inline versus `/loop`**: a chained `auto-resolve-issue` is invoked through the `loop` skill (`/loop /auto-resolve-issue <id>`), so its `ScheduleWakeup` keeps monitoring a pending PR. The auto-continuing notice shows that exact command.
- **Tier written by init-claude**: repo config (`.claude/configuration/arcanum-repo-config.json`), shared and committed. Users can still override a key per user in local state, or for every repo in global config.
- **discuss-issue's second offer**: it currently offers `/auto-fix-issue <id>`, while `plan-issue` and `auto-plan-issue` offer `/auto-resolve-issue <id>`. The spec aligns it to `/auto-resolve-issue <id>`, and when chained, to `/loop /auto-resolve-issue <id>`. The skill change itself lands in #715. Like `plan-issue`, discuss-issue reaches this offer with the plan already pushed on `issue-<id>`, so the branch is safe.
