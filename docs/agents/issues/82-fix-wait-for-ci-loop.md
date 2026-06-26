# Issue: Fix wait for ci loop

## Description
During an `auto-fix-all` run, the architect agent waited for CI by repeatedly waking itself every ~2 minutes via `ScheduleWakeup` instead of delegating to the blocking shell script `scripts/wait_ci.sh`. The result was unnecessary token consumption for work that should be handled entirely by the shell.

## Problem
`process_one_issue.md` already states that the architect agent has no `ScheduleWakeup`, but that declaration was not enough to prevent the agent from using it for CI polling. The agent fell back to a self-waking loop — consuming tokens on every wake cycle — rather than calling `scripts/wait_ci.sh` and blocking until it exits.

The script itself (`scripts/wait_ci.sh`) already handles all the polling correctly; the failure was purely in agent behavior: the step instructions did not explicitly forbid the self-waking anti-pattern for CI, leaving the agent free to improvise.

## Expected Behavior
The architect agent calls `scripts/wait_ci.sh` once (with a sufficiently high Bash timeout so the call doesn't get cut short) and blocks until the script prints `passed` or `failed`. No `ScheduleWakeup` or any other self-waking mechanism is ever used for CI polling.

## Solution
Strengthen the instructions in `auto-fix-all/steps/process_one_issue.md` at the CI-wait step:
- Add an explicit, hard prohibition: never use `ScheduleWakeup` or any other waking/looping mechanism to poll CI — always call `scripts/wait_ci.sh` directly.
- Specify that the Bash tool call must use a `timeout` parameter large enough to cover typical CI durations (the tool supports up to 600 000 ms / 10 minutes), so the call does not time out and force the agent to recover manually.
