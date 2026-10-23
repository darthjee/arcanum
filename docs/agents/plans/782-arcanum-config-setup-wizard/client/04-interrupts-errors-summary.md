# Interrupts, write errors and the summary
Make every exit path print the summary and return the right code.

- **Summary rows.** Keep a running list of rows (`written`, `kept`, `failed`, `not reached`), plus the first error's exit code.
- **Write errors.** A non-validation `CliError` from a write (`LockTimeoutRefusal` `6`, `VersionSkewError` `5`, `FileError` `7`, `TargetUnavailableError` `4`) prints the error through `output`'s error formatting, marks the item failed and continues. The exit code at the end is the first error's code, or `0`.
- **Ctrl-C and EOF at a prompt.** When the prompter rejects with `Interrupted`, mark the current and remaining items `not reached`, print the summary and return `130`. Reuse `EXIT_SIGINT` from `writeTier.js`.
  - The prompter must own SIGINT while it waits: readline's `SIGINT` event plus `process.on('SIGINT')`, removed between prompts.
- **Ctrl-C during a write.** `writeKey` already releases the lock and calls `signals.exit(130)`. Pass a `deps.signals` whose `exit` first prints the summary, then calls `process.exit(130)`.
  - The summary reports that item as `not reached`, or as `written` if the writer resolved first.
- **Summary format** (stderr), matching the spec example: a `summary` heading, then one row per item: the status padded, the key padded, the tier, then `old -> new`, the kept value or the reason. Wildcard items that were never reached collapse to `next_step.auto.*`.

**Specs:** Ctrl-C mid-run (a prompter rejection), EOF, Ctrl-C during a write (a fake `signals` firing SIGINT inside a fake lock), a lock timeout on one item followed by a success on the next (exit `6`), the first error's code winning over a later one, and the exact summary text in each case.

## Files to Change
- `cli/lib/commands/config/setup.js` — the summary bookkeeping, error handling and signal wiring.
- `cli/lib/prompter.js` — the SIGINT/EOF handling.
- `cli/spec/lib/commands/config/setup_spec.js` — the interrupt, error and summary specs.
