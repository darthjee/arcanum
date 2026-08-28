# Fix the reply template path to the install root

**Behavior change.** `core/lib/commands/AutoFixAllReplyComment.js#_renderTemplate` currently does:

```js
const templatePath = path.join(this._repoContext.repoPath, TEMPLATE_RELATIVE_PATH);
```

i.e. it reads `auto-fix-all/templates/reply.tmpl.md` from the **target repo**, not the arcanum install. `reply_comment_shell.sh` reads its own installed copy regardless of `repoPath`. This is the exact wrong-root bug #319 fixed for `github.sh`; fixing it here brings the native path to true parity.

Change:

- `_renderTemplate` → `const templatePath = resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md');`
- Remove `TEMPLATE_RELATIVE_PATH` if nothing else references it (grep — a doc-comment mentions the literal path; that is fine to leave as prose).
- If `MODULE_DIR` / `fileURLToPath` / `import.meta.url` are now unused in the file (Step 02 already moved `RESOLVE_PR_NUMBER_SCRIPT`), remove them and the `node:url` import.
- Update the `_renderTemplate` JSDoc ("Reads `auto-fix-all/templates/reply.tmpl.md`…") to state it reads from the arcanum install, matching the shell script.

Unit spec — `core/spec/lib/commands/AutoFixAllReplyComment_spec.js`:

- Today `writeTemplate(repoPath)` writes the fixture template under the temp `repoPath` and the default `_readFile` reads it from disk. After the change the module reads from the real install root, so the actual `core/../auto-fix-all/templates/reply.tmpl.md` would be used.
- Preferred fix: inject `readFile` as a stub (the constructor already takes `deps.readFile` / `defaultReadFile`) returning a known template string, and assert it was called with `resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`. Drop the `writeTemplate` helper and its `beforeEach` call.
- Alternative if a real read is wanted: point the assertion/expectation at the repo's actual template file via `resolveInstallPath` and keep `_readFile` real — but stubbing is cleaner and matches the rest of this spec's collaborator-injection style.
- Keep all existing rendering/substitution assertions (`%%BODY%%` etc.) working against the stubbed template content.

Parity spec — `core/spec/bin/autoFixAllReplyCommentParity_spec.js`:

- Remove the workaround that seeds a copy of `reply.tmpl.md` under the fixture `repoPath` (the `mkdir(templateDir)` + `writeFile(reply.tmpl.md)` block in the repo-configuration helper, ~lines 108–112, and the comment at ~lines 94–99 describing the divergence).
- Both shell and native now read the same real installed `reply.tmpl.md` (`REAL_TEMPLATE_PATH` is already defined in the spec), so the parity assertion (identical stdout + exit code) should hold without the seeded copy.
- Keep the `origin`-URL rewrite and `resolve_pr_number.sh` handling — those are unrelated to this change.

## Files to Change

- `core/lib/commands/AutoFixAllReplyComment.js` — `_renderTemplate` reads via `resolveInstallPath(...)`; drop `TEMPLATE_RELATIVE_PATH` / unused `MODULE_DIR` / `node:url` import; refresh JSDoc.
- `core/spec/lib/commands/AutoFixAllReplyComment_spec.js` — stub `readFile`, assert the install-root template path, drop `writeTemplate`.
- `core/spec/bin/autoFixAllReplyCommentParity_spec.js` — remove the seed-template-under-repoPath workaround and its explanatory comment.
