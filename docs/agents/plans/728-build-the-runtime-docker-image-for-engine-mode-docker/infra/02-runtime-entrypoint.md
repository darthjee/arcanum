# Runtime entrypoint with nss_wrapper

Add `core/docker-runtime-entrypoint.sh`, a POSIX `sh` script, runtime-only (`core/docker-entrypoint.sh` stays test-only and unchanged):

1. `set -eu`.
2. `mkdir -p "$HOME"` (`/tmp/arcanum-home`, on the `/tmp` tmpfs dispatch provides).
3. Write `$HOME/passwd` with one line for the current uid — `arcanum:x:$(id -u):$(id -g):arcanum:$HOME:/bin/sh` — and `$HOME/group` with `arcanum:x:$(id -g):`. Use `id -u`/`id -g` (numeric; no name lookup).
4. Export `LD_PRELOAD=/usr/local/lib/libnss_wrapper.so`, `NSS_WRAPPER_PASSWD=$HOME/passwd`, `NSS_WRAPPER_GROUP=$HOME/group`. If `LD_PRELOAD` was already set, prepend rather than overwrite.
5. `exec /opt/arcanum/core/bin/arcanum "$@"`.

Keep it idempotent (a second start in the same tmpfs rewrites the same files) and free of root-only operations. No git credential helper or `safe.directory` here: those come from dispatch env (#729).

## Files to Change
- `core/docker-runtime-entrypoint.sh` — new runtime entrypoint (passwd/group via nss_wrapper, then exec the arcanum CLI).
