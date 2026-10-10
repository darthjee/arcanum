# Smoke script and docs

- `arcanum/_lib/test_engine_dispatch.sh`: replace case 8 (native-only docker hard error) with the new behavior. Add docker-mode cases that need no daemon: a status `native` key gives the row-3 warning plus native, a `shell` key gives the row-3b warning plus shell, and `PATH` without `docker` gives the row-4 `docker not found` warning plus native. It stays a standalone smoke script.
- `engine_dispatch` header comment: describe the docker resolution, the new flags and the nested guard (drop the "out of scope for now (#192)" text and the native-only hard error).
- `docs/agents/architecture/script-engine.md`: document `--needs`/`--path-arg` next to the existing flag docs, and point to `specs/docker/dispatch.md` for the docker branch.
- `docs/agents/specs/docker/image.md`: replace "How a contributor forces a rebuild is #729's call." with docs-only guidance (no new code): run `docker rmi darthjee/arcanum:local-<short HEAD>` and the next docker dispatch rebuilds it. Uncommitted changes never change the tag, so a contributor testing local edits must remove the image first.

## Files to Change

- `arcanum/_lib/test_engine_dispatch.sh` — new docker expectations.
- `arcanum/_lib/engine_dispatch.sh` — header doc comment.
- `docs/agents/architecture/script-engine.md` — new flags, docker branch pointer.
- `docs/agents/specs/docker/image.md` — dev-image rebuild guidance.
