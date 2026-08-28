# node Plan: Extract a shared arcanum-install-root helper for native modules that shell out to sibling skill scripts

Main plan: [plan.md](plan.md)

## Overview

Introduce one helper for "the arcanum install root" and migrate every current inline derivation of it onto that helper. Three of the four migrations are pure refactors with no behavior change; the fourth (`AutoFixAllReplyComment`'s `reply.tmpl.md` path) changes behavior — it currently reads the template from the target repo (`repoContext.repoPath`) rather than the arcanum install, the same class of bug #319 fixed for `github.sh`.

## Context

`core/lib/` modules that reference files shipped inside the arcanum skill repo itself (sibling skill scripts, skill templates, `arcanum/_lib/*.sh`) currently each hand-roll the path back to the install root:

```js
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOME_SCRIPT = path.join(MODULE_DIR, '..', '..', '..', '<skill>', 'scripts', '<x>.sh');
```

Current call sites:

| Module | Constant | Target | How it resolves today |
|--------|----------|--------|-----------------------|
| `core/lib/commands/AutoFixAllReplyComment.js` | `RESOLVE_PR_NUMBER_SCRIPT` | `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` | inline `'..','..','..'` from `core/lib/commands/` |
| `core/lib/commands/ArcanumSplitIssueFinish.js` | `GITHUB_SCRIPT` | `arcanum-split-issue/scripts/github.sh` | inline `'..','..','..'` from `core/lib/commands/` (added by #319) |
| `core/lib/core/dispatcher.js` | `configChainPath` | `arcanum/_lib/config_chain.sh` | inline `'..','..','..'` from `core/lib/core/` |
| `core/lib/commands/AutoFixAllReplyComment.js` | `TEMPLATE_RELATIVE_PATH` | `auto-fix-all/templates/reply.tmpl.md` | `path.join(repoContext.repoPath, TEMPLATE_RELATIVE_PATH)` — **wrong root** |

`core/lib/commands/` and `core/lib/core/` are both exactly 3 levels below the repo root; `core/lib/utils/file/` (the helper's home) is 4 levels below. The helper localizes that single fragile walk.

Relevant conventions from [Script Engine](../../architecture/script-engine.md) and the codebase:

- `core/lib/utils/` modules are stateless helpers, normally `export default` classes with injectable deps. This helper has nothing to inject (pure compile-time path math), so it is a plain module with named exports — precedent: `core/lib/utils/issue/Tags.js` exports named constants alongside its default.
- Every migrated entrypoint has a **parity test** (`core/spec/bin/*Parity_spec.js`) asserting shell vs. native produce identical stdout/exit code. `autoFixAllReplyCommentParity_spec.js` currently works around the template-root divergence by seeding a copy of `reply.tmpl.md` under the fixture `repoPath` (see its `configureRepoForShellReplyComment` helper and the comment at ~line 94). Step 04 removes that workaround.
- ESLint flat config: 2-space indent, single quotes, semicolons, `const`/`let`, strict `===`, JSDoc on public functions, no `console.log`.
- `core/spec/` mirrors `core/lib/` 1:1; spec files are `<Name>_spec.js`.

## Steps

- [01 — Add the InstallRoot helper](node/01-add-install-root-helper.md)
- [02 — Migrate the two sibling-script call sites](node/02-migrate-sibling-script-call-sites.md)
- [03 — Migrate configChainPath in the dispatcher](node/03-migrate-config-chain-path-in-dispatcher.md)
- [04 — Fix the reply template path to the install root](node/04-fix-reply-template-path.md)

## CI Checks

- `core/`: `yarn test` (CI job: `test`) — runs `c8 jasmine`; includes the new `InstallRoot_spec.js`, the updated unit specs, and the parity specs.
- `core/`: `yarn lint` (CI job: `checks`) — `eslint .`.
- Local equivalents via the root `Makefile`: `make core-test`, `make core-lint` (or `make core-check` for both), which run the same commands inside `core/docker-compose.yml`.

## Notes

- Step 04 is the only behavior change. After it, the native `auto-fix-all-reply-comment` reads `reply.tmpl.md` from the arcanum install exactly like `reply_comment_shell.sh` does — true parity, not parity propped up by a seeded fixture copy.
- Keep `TEMPLATE_RELATIVE_PATH` as the path *segments* passed to `resolveInstallPath('auto-fix-all', 'templates', 'reply.tmpl.md')`, or inline them — either is fine; do not keep a `repoPath`-joined form.
- No shell script changes. #319's regression fix is assumed already merged (commit `acbe686`).
- Decompose-only risk: `dispatcher.js` builds `configChainPath` at module load and passes it into `new InvocationLog({ configChainPath })`. Importing `resolveInstallPath` there is safe (no circular import — `utils/file/` sits at the bottom of the `commands → context/services → utils` dependency direction).
