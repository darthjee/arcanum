# Scripter Plan: Migrate permission-grant to a constructor-injected ClaudeContext

Main plan: [plan.md](plan.md)

## Shared contracts

### `permission_grant.sh` CLI signature (this agent produces it)

New form: `permission_grant.sh <anchor> add <file> <pattern>`

- `<anchor>` — new leading positional; absolute path to the repo root the Claude
  config is anchored at.
- `<file>`, `<pattern>` — unchanged; `<file>` still accepted as-is (may be
  repo-relative).

### argv into `core/bin/arcanum` (node consumes it)

The shim must dispatch as:

```
engine_dispatch "<anchor>" permission-grant "<permission_grant_shell.sh>" -- "<anchor>" add "<file>" "<pattern>"
```

i.e. the `<anchor>` is forwarded **both** as `engine_dispatch`'s first arg (as
today, currently `$(pwd)`) **and** prepended to the passthrough args after `--`.

### shell-fallback parity (this agent)

`engine.mode=shell` (default) passes `<anchor> add <file> <pattern>` to
`permission_grant_shell.sh`. Its CLI dispatcher must consume + ignore the leading
`<anchor>`. The sourced `permission_grant_add` function is NOT touched — the
`arcanum/migrations/repos/*/*.sh` callers `source` the file and call
`permission_grant_add <file> <pattern>` in-process and must keep working
byte-for-byte.

## Implementation Steps

### Step 1 — Add the leading anchor in `arcanum/_lib/permission_grant.sh`

In the `add)` branch of the direct-invocation CLI dispatcher, the current args
after `shift` are `<file> <pattern>` and the call is:

```bash
engine_dispatch "$(pwd)" permission-grant "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- add "$@"
```

Change the CLI contract to take `<anchor>` first: `permission_grant.sh <anchor> add <file> <pattern>`.
Parse `<anchor>` as `$1`, require it (usage error if empty), `shift`, then keep
the existing `case "$1" in add) …`. In the `add)` branch, after its `shift`,
call:

```bash
engine_dispatch "$anchor" permission-grant "${_PERMISSION_GRANT_LIB_DIR}/permission_grant_shell.sh" -- "$anchor" add "$@"
```

Update the file header's `Used by:` / usage notes and the `Usage:` string to the
new argument order. The unconditional `source` of `permission_grant_shell.sh`
for the `permission_grant_add` function stays exactly as-is.

### Step 2 — Consume the leading anchor in `arcanum/_lib/permission_grant_shell.sh`

Its direct-invocation CLI dispatcher currently is:

```bash
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-}" in
    add) shift; permission_grant_add "$@" ;;
    *) echo "Usage: $0 add <file> <pattern>" >&2; exit 1 ;;
  esac
fi
```

Prepend an anchor consume: read `_anchor="${1:-}"`, require it, `shift`, then run
the existing `case`. The shell path does not use `_anchor` (it resolves `<file>`
against cwd, as today) — it only needs to skip it so `add` lands in `$1`. Update
the `Usage:` string and the header comment to `<anchor> add <file> <pattern>`.
Do **not** touch the `permission_grant_add` function itself.

## Files to Change

- `arcanum/_lib/permission_grant.sh` — CLI dispatcher takes `<anchor>` as `$1`;
  forwards it both to `engine_dispatch` and into the post-`--` passthrough;
  header + `Usage:` updated.
- `arcanum/_lib/permission_grant_shell.sh` — CLI dispatcher consumes and ignores
  a leading `<anchor>`; header + `Usage:` updated. `permission_grant_add`
  untouched.

## Notes

- Keep both files shellcheck-clean (they carry `# shellcheck source=`
  directives). bash 3.2 compatible — no associative arrays, guard `${1:-}`.
- There is no CI job for these shell files; verify by running
  `bash arcanum/_lib/permission_grant.sh <tmpdir> add .claude/settings.json "Bash(x)"`
  in both `engine.mode` defaults (shell) and, if a native build is available,
  with `engine.mode=native`.
