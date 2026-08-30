# Simplify permission_grant_shell.sh CLI dispatcher

`engine_dispatch` now forwards `<anchor> <file> <pattern>` (no `add`) to this
script when it runs as the shell-mode / fallback target. Collapse the CLI
dispatcher to that shape.

Current (lines ~78–96):

```sh
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  _anchor="${1:-}"
  if [[ -z "$_anchor" ]]; then
    echo "Usage: $0 <anchor> add <file> <pattern>" >&2
    exit 1
  fi
  shift
  case "${1:-}" in
    add)
      shift
      permission_grant_add "$@"
      ;;
    *)
      echo "Usage: $0 <anchor> add <file> <pattern>" >&2
      exit 1
      ;;
  esac
fi
```

New:

```sh
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  _anchor="${1:-}"
  if [[ -z "$_anchor" ]]; then
    echo "Usage: $0 <anchor> <file> <pattern>" >&2
    exit 1
  fi
  shift
  permission_grant_add "$@"
fi
```

- Drop the `case "${1:-}" in add) … *) … esac` entirely — there is only one verb
  and it is no longer passed.
- Keep the empty-`_anchor` guard (the anchor is still consumed and ignored, for
  passthrough-shape parity), updating its usage string to drop `add`.
- `_anchor` is still assigned then unused apart from the guard — that matches the
  pre-existing pattern; no need to reference it further.
- **Do not touch** the `permission_grant_add()` function above (lines ~54–76) or
  any of the header/`source` lines.
- Header comment: the "Direct-invocation CLI usage" block (lines ~32–36) shows
  `permission_grant_shell.sh <anchor> add <file> <pattern>` — update to
  `<anchor> <file> <pattern>`. Line ~1 `"permission-grant"` migrated entrypoint →
  `permission-grant-add`.

## Files to Change

- `arcanum/_lib/permission_grant_shell.sh` — the bottom
  `if [[ "${BASH_SOURCE[0]}" == "$0" ]]` CLI-dispatcher block; header-comment
  usage/name touch-ups. Function body untouched.
