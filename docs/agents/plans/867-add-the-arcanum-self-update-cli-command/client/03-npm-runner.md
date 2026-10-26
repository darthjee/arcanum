# npm runner

New module `cli/lib/npm.js`:

- `runNpm(args, { timeout, execFileAsync })` → `{ stdout, stderr }`. Always `execFile('npm', args, { timeout })` with no shell; all output captured, never inherited. The default `execFileAsync` is `promisify(execFile)`, as in `cli/lib/target.js`.
- On failure, throw a classified error. Match npm's error code in stderr with `/npm (?:error|ERR!) code (\S+)/` (npm 9+ and older):

| Signal | Result |
| --- | --- |
| spawn `ENOENT` | `NpmError`: `npm not found on PATH` / `install Node.js and npm, then run it again` |
| `killed` + `SIGTERM` (the `execFile` timeout) | `NpmError`, category `timeout` (the caller words it: network for `view`, `npm root -g failed` for `root`) |
| `signal: 'SIGINT'` | `InterruptedError` (exit `130`) |
| code `EACCES` / `EPERM` | category `permission` |
| code `E404` | category `not_found` |
| code `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNRESET`, `ERR_SOCKET*` | category `network` |
| anything else | category `failed`, with npm's exit code |

The error exposes its `category`, npm's exit code and the last 10 lines of stderr, so `selfUpdate.js` builds the spec's message per call. Keep the module small and free of `self-update` wording beyond the `ENOENT` case.

## Files to Change
- `cli/lib/npm.js` — new: `runNpm` and the classification.
- `cli/spec/lib/npm_spec.js` — new: one spec per table row with a fake `execFileAsync`; argv passed through unchanged; no `shell` option; the timeout forwarded.
