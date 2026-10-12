# Flip both commands to docker

Set `arcanum-create-issue-start` and `arcanum-create-issue-publish` to `"docker"` in `arcanum/_lib/migration-status.json`, so the docker routing cases in step 02 reach `docker run` instead of the native fallback. Don't regenerate the entrypoint status table here; the scripter does that (scripter step 2).

## Files to Change

- `arcanum/_lib/migration-status.json` — both keys `"native"` → `"docker"`.
