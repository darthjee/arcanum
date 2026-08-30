# Update permission_grant.sh engine_dispatch call

Only the `add)` arm of the direct-invocation CLI dispatcher changes.

Current (line ~55):

```sh
engine_dispatch "$anchor" permission-grant "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- "$anchor" add "$@"
```

New:

```sh
engine_dispatch "$anchor" permission-grant-add "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- "$anchor" "$@"
```

Two changes: the engine command name `permission-grant` → `permission-grant-add`,
and the literal `add` token is dropped from the post-`--` passthrough (after the
two `shift`s, `"$@"` is already `<file> <pattern>`).

Keep everything else in the block: the `anchor` capture + empty-anchor `Usage:`
guard, the `case "${1:-}" in add) … *) Usage; exit 1 ;; esac` structure (the
outward CLI still requires the `add` verb), and the `source engine_dispatch.sh`
line.

Header comment: line ~1 calls this the `"permission-grant"` migrated entrypoint —
update to `permission-grant-add`. Line ~26 says the anchor is "forwarded to
engine_dispatch and into the native passthrough args" — adjust the surrounding
wording to note the `add` verb is consumed by the `case`, not forwarded. The
`docs/agents/plans/236-…` reference can stay (historical origin).

## Files to Change

- `arcanum/_lib/permission_grant.sh` — the `engine_dispatch` line in the `add)`
  arm; header-comment name/wording touch-ups.
