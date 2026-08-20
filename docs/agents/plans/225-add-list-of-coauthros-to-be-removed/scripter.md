# scripter Plan: Add list of coauthors to be removed

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add the remove_coauthors config reader](scripter/01-add-remove-coauthors-config-reader.md)
- [02 — Wire the filter into merge_body_coauthors_list](scripter/02-wire-filter-into-merge-body.md)
- [03 — Document all configurations in README.md](scripter/03-document-configuration-in-readme.md)

## Notes

- No shell-script CI exists in this repo today (`.circleci/config.yml` only runs `core/`'s `yarn test`/`yarn lint`, and none of these files live under `core/`) — verify steps 01–02 manually, e.g. by sourcing `arcanum/_lib/merge_body.sh` and calling `merge_body_coauthors_list` against a real PR with `git.remove_coauthors` set in `.claude/state/arcanum-config.json`.
- Step 03 (README) has no functional test — verify by rendering the Markdown and checking the table/JSON example are well-formed.
- README's "Configuration" section must land after the existing "## Skill structure" section per the issue.
