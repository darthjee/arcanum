# Implement the doctor subcommand
Create `cli/lib/commands/config/doctor.js`, following the module shape of `list.js` and `info.js`: export `options = {}`, `positionals = []`, `acceptsTier = false` and `run`, plus a default export `{ name: 'doctor', options, positionals, acceptsTier, run }`.

`run(context)`:
1. Call `readTiers(context, { allTiers: true })`. Do not pass a tier, because `acceptsTier` is false. Add a tier with `file === null` or `read.state === 'missing'` to `skipped` (with a reason) and do not scan it. Add a tier whose `isMalformed(read.state)` is true to `malformed` (with `read.error`) and do not scan it either.
2. For each scanned tier, take `flatten(read.data)`. Skip `null` values and empty-object leaves. Classify each `[key, value]`:
   - `registry.lookup(key) === null`: kind `unknown`. Hint: `arcanum config unset <key> --<tier>`.
   - `registry.allowsTier(key, tier) === false`: kind `tier`, with `allowed_tiers: entry.tiers`. Hint: `arcanum config set <key> <json value> --<registry.defaultTier(key)>`, then `arcanum config unset <key> --<tier>`.
   - Otherwise, when the entry is not `read_only`, run `registry.check('set', key, tier, value)`. If `ok` is false, it is kind `invalid`, and `reason` plus the other failure details come from the check result. Hint: `arcanum config set <key> <value> --<tier>` with a valid value, or `unset`.
3. Output with `output.result(human, data)`:
   - `data = { problems: [{ tier, file, key, value, kind, allowed_tiers?, reason?, hint }], skipped: [{ tier, reason }], malformed: [{ tier, file, error }] }`.
   - Human output groups the problems by tier in resolution order (local, repo, global), with a header showing the tier's display file (`displayFile`). Each problem gets one line, e.g. `  git.safe_branch = "main"   ignored: tier not allowed (allowed: local, global)`, followed by an indented `hint: ...` line. Then add the skipped and malformed notes. With no problems, print `no problems found`.
4. Return `EXIT_FILE` if `malformed` is not empty, else `EXIT_VALIDATION` if there are problems, else `EXIT_OK`.

Register the subcommand in `SUBCOMMANDS` and add a `doctor` entry to `SUBCOMMAND_HELP`, with the synopsis `doctor`, the summary "Report config values that are ignored, unknown or invalid", no rows, and a note listing the exit codes.

## Files to Change
- `cli/lib/commands/config/doctor.js` — new subcommand.
- `cli/lib/commands/config.js` — import it and add it to `SUBCOMMANDS`.
- `cli/lib/help.js` — add the `doctor` entry to `SUBCOMMAND_HELP`, so it shows in `arcanum config --help`.
