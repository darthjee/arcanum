# Native next-step-prompt

Add `core/lib/commands/shared/NextStepPrompt.js`, a native port of the current `arcanum/_lib/next_step_prompt.sh`, and register it in `core/lib/core/commands.js` as `next-step-prompt` (method `run`, context `'none'`). Extend the registry's JSDoc context list to mention it.

Behavior must match the bash exactly:

- **Argument parsing and validation first**, before any config read or TTY probe. That covers repeated `--command`, `--repo`, `--auto-key` (an empty value is an error) and `--no-prompt`. It errors on a missing `--repo`, a non-directory `--repo`, no `--command`, or an unknown flag. Use the same stderr messages and usage line, with nothing on stdout, and exit 1.
- **Auto mode**: read `next_step.auto.<skill>` through `ConfigChain` (`core/lib/utils/config/ConfigChain.js`), with a repo context built from `--repo`. Only JSON `true` enables it. Then print the `auto-continuing: <first command> (next_step.auto.<skill>=true)` notice to stderr and `CHOICE=yes` and `AUTO=true` to stdout, and exit 0 without probing the TTY.
- **`--no-prompt`**: `CHOICE=no`, exit 0.
- **TTY**: open `ARCANUM_TTY_DEVICE` (default `/dev/tty`) through `TtyPrompt`. If it can't be opened, print `FALLBACK=chat` plus one `COMMAND=<cmd>` per `--command` and exit 4. Otherwise write the `Next step:` / `Next steps:` block and `Run it now? [Y]es / [N]o / [C]hat: ` to the TTY, and map y|yes / n|no / c|chat (case-insensitive) to exit 0/0/3. `CHAT_CONTEXT=next_step` goes with chat, other answers re-prompt, and EOF exits 1.

Export the core decision logic, e.g. a method that takes parsed options and returns `{ stdout lines, stderr lines, exitCode }`, so step 02 can reuse it in-process. Add `core/spec/lib/commands/shared/NextStepPrompt_spec.js`, with an injected fake `TtyPrompt` and `ConfigChain` env to cover every branch.

## Files to Change
- `core/lib/commands/shared/NextStepPrompt.js` — new native command.
- `core/lib/core/commands.js` — register `next-step-prompt` and update the context JSDoc.
- `core/spec/lib/commands/shared/NextStepPrompt_spec.js` — new unit spec.
