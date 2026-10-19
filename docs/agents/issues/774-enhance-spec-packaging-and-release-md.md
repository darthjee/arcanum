# Enhance spec: packaging-and-release.md

## Context

Part of epic #767 (Arcanum user-facing CLI for configuration) — see the epic for the full design decisions. The "Write the arcanum CLI spec" sub-issue produced a first version of `docs/agents/specs/arcanum-cli/packaging-and-release.md`, which still lists open points and does not yet cover edge cases, backward compatibility, testing, performance or security in depth. This issue deepens and reviews that file. It can run in parallel with the other "Enhance spec" sub-issues.

## What needs to be done

Docs only — no code. Owner: `architect`.

Deepen `docs/agents/specs/arcanum-cli/packaging-and-release.md`, focusing on:

- the `cli/` folder layout;
- `cli/package.json` fields;
- the build output;
- npm publish in CircleCI: token storage, provenance, failure handling;
- version lockstep with arcanum releases;
- supply-chain considerations.

In addition:

- Resolve the open points recorded in the file (npm `--provenance`, failure handling when npm publish fails after the GitHub release succeeded, the minimum Node.js version in `engines.node`, the npm dist-tag for pre-release tags).
- Cover, for what the file describes: edge cases, backward compatibility, testing strategy, performance and security considerations.
- Keep cross-links with the index (`docs/agents/specs/arcanum-cli.md`) and the other spec parts consistent, and update the index's open-points list accordingly.

## Acceptance criteria

- [ ] Every open point listed in `packaging-and-release.md` is resolved (or explicitly deferred with a reason).
- [ ] The file covers the `cli/` layout, `package.json` fields, build output, CircleCI npm publish (token storage, provenance, failure handling), version lockstep and supply-chain considerations.
- [ ] The file has edge cases, backward compatibility, testing strategy, performance and security sections for what it describes.
- [ ] Cross-links to the index and the sibling spec files are consistent, and the index's open-points list reflects the resolutions.
- [ ] No code changes.
