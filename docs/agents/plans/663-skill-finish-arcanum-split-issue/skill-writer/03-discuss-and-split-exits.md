# Discuss and split exits

- `steps/discuss.md` §3: if `github.sh update` exits non-zero, **fail with** `Publish parent draft` (see push.md's Failed exits), passing the planning change.
- `steps/split.md` §2 decline (`confirm.sh` exit 1): keep the existing explanation (files remain locally, resumable), then release the working tree and print a `declined` report with `--issue <id>` and the planning change. No offer. Replace the current ad-hoc closing prose with this.

## Files to Change
- `arcanum-split-issue/steps/discuss.md` — failed exit on parent update failure.
- `arcanum-split-issue/steps/split.md` — declined report on rejected confirmation.
