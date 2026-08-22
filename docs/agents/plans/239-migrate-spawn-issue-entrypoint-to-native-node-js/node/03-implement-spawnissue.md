# Implement SpawnIssue.js and wire it into the CLI

Create `core/lib/SpawnIssue.js`, mirroring `spawn_issue.sh` step for step:

1. **Create (retried)**: read retry tuning via `RepoConfig#getPlanIssuesRetryConfig` (step 02). Loop up to `maxRetryCount` times calling `GithubIssue#create(repoPath, title, bodyFile)` (in-process JS call, per #237/PR #248 — do **not** shell out to `core/bin/arcanum github-issue-create`). On success, parse `ID=`/`FILE=` out of its returned string. On repeated failure, sleep `errorSleepTime` seconds between attempts (matching the shell's `sleep`); once retries are exhausted, throw `new DispatchFailure('STATUS=failed\n')` (step 01) — nothing to clean up, matching the shell's own "create only writes its scratch file on success" comment.
2. **Labels (best-effort)**: `gh issue view <parentId> -R <repo_ref> --json labels -q '.labels[].name'` via `execFile` (array args, never string-interpolated — same pattern as `GithubToken.js`). For each returned label, keep it only if `Tags.extractTags([label])` is empty (i.e. it doesn't map to any canonical pipeline tag); always add `Spawned` on top. Apply via `gh issue edit <new_id> -R <repo_ref> --add-label <label> [--add-label <label> ...]`. If the parent-labels lookup itself fails, fall back to applying just `Spawned`. Any `gh` failure here is caught and only warned to stderr — never thrown.
3. **Linking (best-effort)**: `gh issue comment <parentId> -R <repo_ref> --body "Spawned issue #<new_id>: <title>"` and `gh issue comment <new_id> -R <repo_ref> --body "Spawned from #<parentId>"`. When `asSubissueFlag` is set: fetch both issues' GraphQL node ids (`gh issue view <id> -R <repo_ref> --json id -q .id`) and run the `addSubIssue` mutation via `gh api graphql -f query=... -F issueId=... -F subIssueId=...`; on any failure in this block, warn to stderr with the same "created but not linked; link it manually on GitHub" message — never throw.
4. **Cleanup**: `unlink` the scratch file `create` wrote (its `FILE=` value, resolved against `repoPath`). On failure, print the same loud multi-line stderr warning block `spawn_issue.sh` does; still resolve normally (exit 0 for this whole call).

On full success, return `` `STATUS=ok\nID=${newId}\nURL=${url}\n` `` where `url` is built the same way `spawn_issue.sh` does (`https://<domain>/<repo_ref>/issues/<new_id>`, from `Origin#resolve`).

Register the command: add `'spawn-issue': { module: 'SpawnIssue.js', method: 'run' }` to `core/bin/arcanum`'s `COMMANDS` registry.

Constructor dependencies (for testability, following `GithubIssue`/`GithubToken`'s existing DI pattern): injectable `origin`, `githubIssue`, `repoConfig`, `tags` (or use `Tags`'s static method directly, no instance needed), and `execFileAsync`.

## Files to Change
- `core/lib/SpawnIssue.js` — new; implements the four steps above.
- `core/bin/arcanum` — add the `spawn-issue` entry to `COMMANDS`.
