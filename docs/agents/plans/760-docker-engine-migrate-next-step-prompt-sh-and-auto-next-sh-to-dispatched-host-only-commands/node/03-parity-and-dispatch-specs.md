# Parity and dispatch specs

The existing contract specs `core/spec/bin/nextStepPromptShell_spec.js` (#681/#714) and `core/spec/bin/autoPlanIssueAutoNext_spec.js` (#715) say they are "NOT a parity spec" because no native counterpart existed. Turn them into parity specs, following the precedent of the other `*Parity_spec.js` files, e.g. `finishReportParity_spec.js` and `autoPlanIssueCommitPlanParity_spec.js`. Run every case against the `_shell.sh` twin and against `core/bin/arcanum <command>`, and assert identical stdout, stderr and exit code. Rename the files (e.g. `nextStepPromptParity_spec.js`, `autoPlanIssueAutoNextParity_spec.js`) and update their header comments.

Cases to keep or add:
- **next-step-prompt**: every usage error, auto-key true / false / absent / string `"true"` across the local, repo and global tiers, `--no-prompt`, and the no-TTY exit-4 fallback with one and with several `--command`s. Interactive TTY answers stay out of scope, as today.
- **auto-next**: usage errors, `REASON=branch`, `REASON=config`, `CHAIN=yes` with a local bare origin, and `REASON=push`.

Add engine-dispatch routing cases, following `autoPlanIssueCommitPlanEngineDispatch_spec.js` / `sharedLibEngineDispatch_spec.js` and the `engineDispatchLib.js` helpers:
- Under `engine.mode=docker` both shims run **native on the host**, never `docker run`, with no fallback warning.
- Under `shell` they run the twin.
- The `next_step_prompt.sh` shim's no-`--repo` path still exits 1 with the shell's usage error.

## Files to Change
- `core/spec/bin/nextStepPromptShell_spec.js` → `core/spec/bin/nextStepPromptParity_spec.js` — converted to parity.
- `core/spec/bin/autoPlanIssueAutoNext_spec.js` → `core/spec/bin/autoPlanIssueAutoNextParity_spec.js` — converted to parity.
- `core/spec/bin/sharedLibEngineDispatch_spec.js` and a new or existing auto-plan-issue engine-dispatch spec — host-only routing cases.
