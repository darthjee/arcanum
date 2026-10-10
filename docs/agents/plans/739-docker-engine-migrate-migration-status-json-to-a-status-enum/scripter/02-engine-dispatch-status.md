# Add _engine_dispatch_status and switch dispatch to it

Replace `_engine_dispatch_native_available` with `_engine_dispatch_status <command> <native_only>`, implementing the reading-rule table in [plan.md](../plan.md#shared-contracts). Suggested approach: one `jq` call that prints the raw value with its type, e.g. `.[$cmd] | if type == "string" then . elif type == "boolean" then (if . then "true" else "false" end) else "" end`, with stderr suppressed and a non-zero exit treated as malformed. Then a bash `case`:

- `shell|native|docker|host-only` → that value (for native-only, `shell` → `native`);
- `true` → `native`; `false` → `shell` (dual) / `native` (native-only);
- anything else, missing file, or jq failure → `shell` (dual) / `native` (native-only).

Always exit 0 and print exactly one line.

In `engine_dispatch`, change only the dual-entrypoint `native` branch: fall back to shell, with the unchanged warning, when `$(_engine_dispatch_status "$command" false)` is `shell`, and run native otherwise. Leave the `shell` branch, the `docker` branch and the whole `--native-only` path untouched.

Update the function's header comments and `engine_dispatch`'s big doc comment. Step 3 in "Resolution" should describe the enum. In the `[--native-only]` paragraph, "native-only commands are never listed there" becomes "native-only commands are listed with a non-`shell` status, but this path does not consult the map yet (docker branch, #729)".

## Files to Change

- `arcanum/_lib/engine_dispatch.sh` — new `_engine_dispatch_status`, remove `_engine_dispatch_native_available`, native branch uses the new function, doc comments updated.
