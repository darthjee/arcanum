# Update command-surface.md

Make `docs/agents/specs/arcanum-cli/command-surface.md` consistent with the lock and `ConfigError` decisions.

- **`### Lock contention`:** reword the first bullet so exclusion between the CLI and skills is stated as holding with the protocol from #807 (atomic create-if-absent), which is a hard blocker for the CLI's write commands. Replace the "**Dependency.**" bullet (bounded wait on `Lock`, "lock-interoperability open point") with a pointer to #807 and to [Shared Config Logic](shared-config-logic.md)'s lock decision. Add: a timeout means the lock file existed for the whole wait — the CLI wrote nothing, so there is nothing to clean up. Keep `--lock-timeout` semantics and the "seems stuck" warning bullet.
- **`### Missing and malformed tier files`:** add the non-object-intermediate case — a valid-object file whose intermediate path holds a non-object (e.g. a hand-edited `.git` string, then `set git.authors …`) is refused with exit `7`, via `ConfigError('NOT_AN_OBJECT')`, file unchanged.
- **Error mapping:** where the exit-code section or error-messages section talks about how shared-code errors become exit codes, reference the `ConfigError` mapping in Shared Config Logic (`LOCK_TIMEOUT`→6, `NOT_AN_OBJECT`/`INVALID_JSON`/errno→7) rather than restating it.
- Check the edge-case bullets ("Concurrent CLI writes", Ctrl-C while holding the lock) still read correctly with owner-checked release; adjust wording only if needed.

## Files to Change
- `docs/agents/specs/arcanum-cli/command-surface.md` — lock-contention wording, malformed-file row, `ConfigError` cross-reference.
