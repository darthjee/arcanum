# Simplify the id contract

Rewrite `resolve_and_fetch.sh`'s id resolution so it no longer delegates to `resolve_id_and_file.sh`'s Scenario A/B/C matrix. It gets its own small, dedicated parser instead: the `arg_string` argument must match `^#[0-9]+$` (surrounding whitespace trimmed). Anything else — empty string, `#abc`, `#193 - title`, a bare title — produces the exact output `STATUS=error\nERROR=Error: invalid input '<raw_input>' — expected '#<id>'\n`, exit 0. Keep the existing-file lookup (`docs/agents/issues/<id>_*`/`<id>-*` glob, first match wins) inline, but drop `title_to_snake_case`/`build_file` entirely — they were only ever used to compute a `FILE=` guess that got discarded downstream (see the issue's Scope section for why).

`resolve_id_and_file.sh` itself is untouched by this step — `auto-new-issue` still needs its full generality for its own title-only "create a new issue" flow. Only `resolve_and_fetch.sh` stops calling it.

This step lands before Step 02 — Step 02 restructures the file into a dispatch shim around whatever logic results from this step.

## Files to Change

- `arcanum/_lib/resolve_and_fetch.sh` — replace the `resolve_id_and_file.sh` delegation with the dedicated `^#[0-9]+$` parser and uniform `STATUS=error` handling described above.
