# CLEAR=true in NextStepPrompt

In `core/lib/commands/shared/NextStepPrompt.js`, after `autoEnabled(options)` returns
`true`, read `next_step.clear.<autoKey>` with a new `clearEnabled(options)` (same
shape as `autoEnabled`: `ConfigChain.read(path.resolve(repoPath), 'next_step',
`clear.${autoKey}`) === true`, any throw → `false`). When enabled, stdout becomes
`CHOICE=yes\nAUTO=true\nCLEAR=true\n` and the notice
`auto-continuing: <cmd> (next_step.auto.<k>=true, next_step.clear.<k>=true)\n`;
otherwise output is unchanged. Never read the clear key when auto did not fire.
Update the class JSDoc contract.

Specs in `core/spec/lib/commands/shared/NextStepPrompt_spec.js`: clear on → three
lines + two-key notice; clear `false`/absent/`"true"`/`1` → unchanged output; clear
read throws → auto result kept; auto off + clear on → no `CLEAR` (with and without
`--no-prompt`); TTY `y` with clear on → `CHOICE=yes` only; clear key not read when
auto is off (configChain stub call assertions).

## Files to Change
- `core/lib/commands/shared/NextStepPrompt.js` — `clearEnabled`, `CLEAR=true` line, two-key notice, JSDoc.
- `core/spec/lib/commands/shared/NextStepPrompt_spec.js` — new cases above.
