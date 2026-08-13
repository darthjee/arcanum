# Lightweight Exploration

By this point, [fetch.md](fetch.md) has already resolved the id, guaranteed `FILE` exists with content, and handled any already-tracked sub-issues. Read `FILE`.

This is a very light pass — lighter than `discuss-issue`'s exploration, and scoped narrower than `enhance-issue`'s (which also looks for edge cases). The goal is to understand the feature being split, not to plan its implementation. Look for:

1. Other similar features already implemented in the codebase — precedent for how the split could shape up.
2. Which specialist agents (`.claude/agents/*.md`, if any exist in this project) would plausibly own each likely part of the work.
3. What parts of the code could be involved (routes, infra, specific modules, etc.).

Do not investigate edge cases or in-depth security concerns here — if any surface during this pass, bring them up during discussion instead ([discuss.md](discuss.md)) rather than digging into them now.

Skip this entirely if the issue is simple enough that no code context would meaningfully change the splitting conversation.

Once done, proceed to [discuss.md](discuss.md).
