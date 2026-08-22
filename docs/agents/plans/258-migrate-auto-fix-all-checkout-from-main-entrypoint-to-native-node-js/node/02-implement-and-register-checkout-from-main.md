# Implement AutoFixAllCheckoutFromMain and register it

Create `core/lib/AutoFixAllCheckoutFromMain.js`, re-deriving `checkout_from_main.sh` + `arcanum/_lib/git_branch.sh`'s combined logic natively (no shelling out to either shell file, per `script-engine.md`'s "No standalone, wholesale `_lib` migration" rule). Follow `SafeBranch.js`'s shape closely — same constructor-injection style (`execFileAsync`, a `RepoPath` instance), same `{ cwd: repoPath }` option on every `execFile` call instead of `git -C <repoPath>` argv flags.

## Algorithm (mirror exactly, including the two-fetches-of-main quirk)

```
run(repoPath, id):
  if !repoPath || !id: throw Error('Usage: checkout_from_main.sh <repo_path> <id>')
  await this._repoPath.validate(repoPath)   // same messages as repo_path_enter
  branch = `issue-${id}`

  await this._fetchTolerant(repoPath, 'main')
  await this._fetchTolerant(repoPath, branch)

  localExists  = await this._refExists(repoPath, `refs/heads/${branch}`)
  remoteExists = await this._refExists(repoPath, `refs/remotes/origin/${branch}`)

  status = 'ok'
  conflicts = ''

  if (localExists || remoteExists) {
    if (localExists) checkout branch
    else              checkout -b branch origin/<branch>

    await this._fetchTolerant(repoPath, 'main')  // git_branch_merge_main re-fetches main
    if (await this._refExists(repoPath, 'refs/remotes/origin/main')) {
      try {
        await execFileAsync('git', ['merge', '--no-edit', 'origin/main'], { cwd: repoPath })
      } catch {
        status = 'conflict'
        conflicts = (await execFileAsync('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: repoPath })).stdout
      }
    }
  } else {
    if (await this._refExists(repoPath, 'refs/remotes/origin/main')) checkout -b branch origin/main
    else                                                              checkout -b branch main
  }

  output = `BRANCH=${branch}\nSTATUS=${status}\n`
  if (status === 'conflict') {
    output += conflicts.replace(/\n*$/, '\n')   // trim trailing blank lines, then exactly one — matches `echo "$CONFLICTS"` after command-substitution stripped CONFLICTS's own trailing newlines
    throw new DispatchFailure(output, 2)
  }
  return output
```

`_fetchTolerant(repoPath, ref)` runs `git fetch origin <ref>` (`{ cwd: repoPath }`); on failure, inspects `error.stderr` against the case-insensitive regex `/couldn't find remote ref|not found|no such ref/i` — matches: swallow, return normally. No match: throw `Error('Error: git fetch origin ' + ref + ' failed: ' + error.stderr.trim())`, matching the shell script's two distinct messages (`git fetch origin main failed: ...` vs. `git fetch origin ${BRANCH} failed: ...` — same helper, different `ref` argument each call).

`_refExists(repoPath, ref)` runs `git show-ref --verify --quiet <ref>` (`{ cwd: repoPath }`); resolves `true`/`false` on exit 0/1, same try/catch-on-exit-1 shape as `SafeBranch.js`'s `_diffIsClean`.

## Register in COMMANDS

In `core/bin/arcanum`'s `COMMANDS` map, insert (alphabetically, right before the existing `'auto-fix-all-cleanup-artifacts'` entry — `checkout` sorts before `cleanup`):

```js
'auto-fix-all-checkout-from-main': { module: 'AutoFixAllCheckoutFromMain.js', method: 'run' },
```

## Files to Change

- `core/lib/AutoFixAllCheckoutFromMain.js` — new module, per the algorithm above.
- `core/bin/arcanum` — add the `COMMANDS` entry.
