# Parity and dispatch specs

After the scripter's shell-twin changes, extend the bin specs:

- `core/spec/bin/nextStepPromptParity_spec.js` — shell vs native, byte-identical
  stdout/stderr/exit for: auto+clear on (three lines, two-key notice); auto on, clear
  `false`; clear on in repo tier with auto in global tier (mixed tiers); local
  `false` shadowing repo `true`; non-boolean clear (`"true"`); malformed config for
  the clear read keeping the auto result if achievable through fixtures; auto off +
  clear on, with `--no-prompt`.
- `core/spec/bin/autoPlanIssueAutoNextParity_spec.js` — `CHAIN=yes\nCLEAR=true\n`
  parity; `CHAIN=no` with clear on.
- `core/spec/bin/initClaudeSetNextStepClear_spec.js` — new, mirroring
  `initClaudeSetNextStepAuto_spec.js` through the real `set_next_step_clear.sh` shim
  (writes the key, prints `NEXT_STEP_CLEAR=…`, usage/validation errors).

Existing cases in these files must pass unchanged.

## Files to Change
- `core/spec/bin/nextStepPromptParity_spec.js` — new clear cases.
- `core/spec/bin/autoPlanIssueAutoNextParity_spec.js` — new clear cases.
- `core/spec/bin/initClaudeSetNextStepClear_spec.js` — new.
