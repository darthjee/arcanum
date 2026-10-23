# Command skeleton, TTY guard and section selection
Add the `setup` subcommand and everything that runs before the first prompt.

- **Wiring.** Add `cli/lib/commands/config/setup.js` and register it in `SUBCOMMANDS`, in `cli/lib/commands/config.js`.
  - `acceptsTier = false`. It takes any number of section positionals, so it needs a variadic arity entry or a custom check.
  - It accepts `--lock-timeout`, which it forwards to every write.
- **Input stream.** Extend `main.js`'s `DEFAULT_IO` with `stdin: process.stdin`, and pass it through `run`'s `io` option. Add `cli/lib/prompter.js`: a small line-based prompter over `io.stdin`/`io.stderr`.
  - `ask(question)` resolves the typed line, or rejects with an `Interrupted` error on EOF or SIGINT.
  - It is injectable through `deps.prompter` for specs.
  - It uses `node:readline` (no new dependency), with `terminal: false` for injected streams.
- **TTY guard.** The wizard needs `io.stdin.isTTY && io.stderr.isTTY`, or an injected `deps.isInteractive`. Otherwise throw `UsageError('config setup needs an interactive terminal', {hint: 'use arcanum config set / the shortcuts instead'})`, which is exit `2`. `--json` with `setup` is also a `UsageError`.
- **Sections.**
  - Validate the positionals against `SETUP_SECTIONS`. An unknown section is a `UsageError` whose hint lists the valid ones.
  - Deduplicate, then order canonically.
  - Build the item list from `registry.entries()` filtered by `setup`, sorted by section index, then by `order`.
  - Expand `setup.instances` for wildcard keys. `git.agents.<agent>` is expanded later, in step 03.
- **Targeting.**
  - Resolve the targets once, with `memoizeTargets`.
  - With no repo, or an unconfigured one, drop every item whose default or only tier is `repo` or `local`, the per-agent item and the whole `ci` section. Print a one-line `note:` for each skipped section. An unconfigured repo also gets the `/init-claude` hint.
  - If nothing is left, throw `TargetUnavailableError` (exit `4`) after the notes.
- **Help.** Add `setup` to `help.js` (`configUsage`/`subcommandUsage`).
- **Specs.** Add `cli/spec/lib/commands/config/setup_spec.js` with a scripted fake prompter and a fake `stdin` in `fakeIo`. It covers: no TTY, `--json`, an unknown section, the subset with duplicates and order, no repo, an unconfigured repo, and nothing left to ask.

## Files to Change
- `cli/lib/commands/config/setup.js` — new: the subcommand, the section and item selection, and targeting.
- `cli/lib/commands/config.js` — register `setup`.
- `cli/lib/prompter.js` — new: the readline prompter, with the EOF/SIGINT `Interrupted` rejection.
- `cli/lib/main.js` — `stdin` in `DEFAULT_IO`.
- `cli/lib/args.js` — variadic arity for `setup`, if `checkArity` needs it.
- `cli/lib/help.js` — the `setup` usage.
- `cli/spec/support/fakeIo.js` — an optional scripted `stdin` and `isTTY` flags.
- `cli/spec/lib/commands/config/setup_spec.js` — new.
