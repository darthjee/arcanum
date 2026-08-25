# Node Plan: Split autoFixAllQueueParity_spec.js into per-subcommand files

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add seedOriginUrl and export REPO_ROOT in runCommand.js, relocate expectParity there](node/01-add-seedoriginurl-and-relocate-expectparity.md)
- [02 — Update githubParitySetup.js to use seedOriginUrl and drop expectParity](node/02-update-githubparitysetup.md)
- [03 — Repoint the 8 autoFixAllGithubParity/*.js files' expectParity import](node/03-repoint-github-family-expectparity-imports.md)
- [04 — Migrate the remaining 6 origin-seeding call sites to seedOriginUrl](node/04-migrate-remaining-origin-seeding-call-sites.md)
- [05 — Create queueParitySetup.js](node/05-create-queueparitysetup-factory.md)
- [06 — Split autoFixAllQueueParity_spec.js into per-subcommand files](node/06-split-queue-parity-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- Zero behavior change to test count/assertions: 14 test cases before and after, same expectations, same stdout/exit-code fixtures.
- One deliberate, harmless behavior change: the queue split's `git` calls switch from a local helper with no explicit author/committer env to the shared `runCommand.js` `git`, which sets `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_NAME`/`GIT_COMMITTER_EMAIL`. No assertion in any of these specs depends on commit authorship, so this is a no-op for test outcomes — confirmed with the user during discussion (see the issue file).
- Each step below should be run through `yarn test`/`yarn lint` before moving to the next, so a break is caught at the step that introduced it rather than at the end.
