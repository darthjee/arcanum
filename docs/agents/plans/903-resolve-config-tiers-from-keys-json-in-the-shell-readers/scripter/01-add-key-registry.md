# Add key_registry.sh

Add `arcanum/_lib/key_registry.sh` as a sourced library, following the header and double-sourcing guard style of `safe_branch.sh`. It implements `key_registry_allows_tier` and `key_registry_has_key` exactly as defined in [plan.md's Shared contracts](../plan.md#shared-contracts).

Implementation notes:

- Resolve the library dir once (`_KEY_REGISTRY_LIB_DIR`). Inside each function, use `${KEY_REGISTRY_FILE:-$_KEY_REGISTRY_LIB_DIR/../../shared/lib/config/keys.json}`, so a spec can set the variable after sourcing.
- **Validate segments in jq or with a bash `[[ =~ ]]`.** Split on `.`. Every segment must match `^[A-Za-z0-9_-]+$`, and an empty key or an empty segment (for example `a..b`) is malformed. Mirror `KeyRegistry#lookup`.
- **Do the whole lookup in one jq program.** Pass the key and tier with `--arg`, and have it print `true`, `false` or `null`:
  1. literal match first;
  2. then the first entry in registry order with the same segment count where each entry segment either equals the key segment or matches `^<[A-Za-z0-9_-]+>$`;
  3. no match prints `null`.
- **Failure handling.** If the file is missing or jq fails (invalid JSON, no `keys` array), print `null`. Never print anything on stderr, and always exit 0.
- **Invalid tier.** A tier outside `local`, `repo` and `global` prints `null` before jq runs.
- **`key_registry_has_key`** reuses the same lookup and exits 0 when an entry matched, 1 otherwise. It prints nothing.
- No config helper calls, so `ShellConfigKeyScan_spec.js` needs no exemption.

## Files to Change

- `arcanum/_lib/key_registry.sh`: new.
