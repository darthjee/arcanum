# Lightweight Exploration

By this point, [fetch.md](fetch.md) has already resolved the id and guaranteed `FILE` exists with content. Read it.

This is deliberately lighter than `discuss-issue/steps/discuss_and_save.md`'s equivalent step: since the issue is still expected to be vague at this stage, do **not** spawn specialist agents by default. Just:

1. Read `FILE`'s content for general understanding of the idea.
2. If the idea plausibly references specific existing code, files, or behavior, do a quick read of the obviously-relevant parts yourself (e.g. a targeted `grep`/file read) — enough to hold an informed dialogue, not a deep investigation.

Skip this entirely if the idea is simple enough that no code context would meaningfully change the conversation.

Once done, proceed to [dialogue.md](dialogue.md).
