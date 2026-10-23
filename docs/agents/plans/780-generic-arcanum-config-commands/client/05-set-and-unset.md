# Write commands: set and unset
Implement the writes, running the refusal checks in precedence order: usage (step 01), then target (`4`), file (`7`), registry (`3`), skew (`5`) and lock (`6`).

- A tier is required. Before writing, read and parse the target file with `tierFiles.js`. Any malformed state refuses with exit `7` and leaves the bytes unchanged, and `--force` does not bypass this.
- Registry: `KeyRegistry#check` for type, enum, tier and read-only. Unknown keys are refused with exit `3` unless `--force` is passed. `--force` bypasses only unknown keys and skew. `null` on a known key exits `3` with the `config unset` hint.
- Write through `RepoConfigWriter`. Split the dotted key into `namespace` plus the remaining `key` when it has two or more segments. A one-segment key (or a `--force`d unknown one) uses the top-level `write` without `namespace`. Pass the tier's legacy file where the tier has one, mirroring `ConfigChain`'s tier files. `unset` uses `RepoConfigWriter#unset`. A missing key is a no-op that exits `0`, with `"changed": false` in the JSON output.
- Lock: pass `timeoutMs = --lock-timeout × 1000` (default 10 s, and `0` means a single try). `LockTimeoutError` exits `6` with the lock-file name and the remove-by-hand hint. Suppress `Lock`'s own "seems stuck" warning (`warn: false` if the writer exposes it). If not, raise it as a `shared` issue rather than patching it. On SIGINT while the lock is held, release it and exit `130`.

## Files to Change
- `cli/lib/commands/config/set.js`, `cli/lib/commands/config/unset.js` — the write commands.
- `cli/lib/writeTier.js` (new) — the shared pre-write checks (file, registry, skew) and the `RepoConfigWriter` call with the timeout and SIGINT handling.
- `cli/spec/lib/commands/config/set_spec.js`, `cli/spec/lib/commands/config/unset_spec.js`, `cli/spec/lib/writeTier_spec.js` (new) — one spec per exit code and per precedence pair. They cover bytes unchanged on refusal, siblings kept, empty parents not pruned, lock held by a fake owner (timeout and `0`), and the JSON shapes.
