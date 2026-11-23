# Acceptance Criteria and Risks

Hub: [specs.md](specs.md)

## Acceptance criteria

- Running a split in Flow C produces exactly today's output, byte for byte in structure.
- Running a split in Flow A produces the four ordered issue types, each carrying the pointer to the same hub path.
- An issue with a valid pointer leads `plan-issue` to read the hub before planning.
- An issue whose pointer file is absent, and whose path has no deletion history, produces the "generation has not run" verdict and blocks automation with an explicit reason.
- An issue whose pointer file was deleted produces the deletion commit and the restore option.
- A body rewrite that would remove the pointer gets it re-inserted verbatim. A rewrite that would change it fails unless explicitly overridden. Neither case succeeds silently.
- A completed fold leaves no spec files, an updated index, provenance in `docs/agents`, and closed issues untouched.
- A consumer repository that has not migrated still receives the new question from the skill.

## Risks

- **Silent loss of the pointer** through body rewrites. Mitigated by the shared push guard ([guard.md](guard.md)).
- **Ordering gaps** that cause repeated automation failures. This is the highest-risk item. Mitigated by "blocked by" ordering enforced at queue entry and at pop time ([ordering.md](ordering.md)).
- **Spec and implementation drift.** Implementation issues generated inline (Flow B) may diverge from the spec as written. Mitigated by the precedence rule ([dialogue.md](dialogue.md)).
- **Fold content loss** if the section map is incomplete. Mitigated by a hub-owned, reviewable, idempotent and re-runnable fold ([fold.md](fold.md)).
- **Migration churn** in repositories with customized templates. Mitigated by keeping the flow logic in the skill ([migration.md](migration.md)).
