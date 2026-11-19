# Reads, writes and failures

Part of [Arcanum CLI](../arcanum-cli.md). This page covers tier-file states, refusal ordering, locking, output and exit codes.

## Missing and malformed tier files

Tier reads are never throw-based and produce these states:

| State | Reads | Writes |
|---|---|---|
| Missing | Empty tier | Create on first write |
| Empty/whitespace | Empty tier | Write as `{}` |
| Invalid JSON | Warning; ignore tier | Refuse `7` |
| Not object | Warning; ignore tier | Refuse `7` |
| Unreadable/not UTF-8 | Warning | Refuse `7` |
| Not writable | Normal read | Refuse `7` |

Malformed files are never overwritten. A UTF-8 BOM is removed for reads but not written back. A non-object on a key path is caught before write.

## Refusal order

Checks run in this order:

1. Usage `2`: argv, tier flags, arity and key syntax.
2. Target `4`: repo/account availability and configured state.
3. File `7`: target tier parse and key-path shape.
4. Registry `3`: known key, value, tier and read-only checks.
5. Skew `5`: target tier pointer ahead of CLI.
6. Lock `6`: bounded lock acquisition.

File/target checks happen before registry/skew checks. This order is stable so scripts can depend on it.

## Reads

Reads take no lock and can observe an old or new whole-file state while a write is replacing it. Tiers are read local → repo → global according to the resolved target. No tier plus no repo means global only, with warning.

`list` flattens objects and treats scalars, arrays, null and empty objects as leaves. `info` uses strict reads and reports file/skew state instead of warnings.

## Writes

`RepoConfigWriter#write`/`unset` preserve siblings, write nested paths, serialize compact JSON and rename a temporary file atomically under `<file>.lock`. Unsetting an absent key skips locking/writing and reports `changed: false`.

### Lock contention

- Shared Lock protocol is compatible with running Arcanum shell skills.
- Default wait is 10 seconds; `--lock-timeout` accepts decimals or `0` for one attempt.
- Timeout exits `6` with hint to remove the lock only if no Arcanum process is running.
- SIGINT while waiting exits `130` without writing or leaving a lock. SIGINT while holding the lock releases it before interrupting.

## Output

Human output is the default; `--json` produces machine-readable output. Stdout contains only command results. Stderr contains warnings, notes and errors.

A normal JSON error is:

```json
{"error":{"code":"target_unavailable","exit":4,"message":"arcanum: ...","hint":null}}
```

Existing JSON fields may be added but may not be renamed or removed without a major version. `--json` detection also happens on raw argv for errors before parsing.

## Exit codes

| Exit | JSON code | When |
|---|---|---|
| `0` | — | Success |
| `1` | `error` | Runtime/generic or unset `get` |
| `2` | `usage` | Unknown flags/commands, syntax or arity |
| `3` | `validation` | Registry/key/value rejection |
| `4` | `target_unavailable` | No repo/account or unconfigured target |
| `5` | `version_skew` | Target ahead without force |
| `6` | `lock_timeout` | Lock acquisition timeout |
| `7` | `file` | Malformed tier or I/O failure |
| `8` | `npm` | npm/update failures |
| `130` | `interrupted` | SIGINT |

Errors print one `arcanum: ...` line and an optional `hint:` line. Values over 40 characters are summarized. `ARCANUM_DEBUG=1` adds stacks.
