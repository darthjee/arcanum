# Lightweight Exploration

By this point, [start.md](start.md) has guaranteed `FILE` exists with content: either the user's initial idea under a proposed `# <Title>` heading, or a resumed draft. Read it.

This is the same light pass as `enhance-issue`'s exploration step, run on the draft instead of a fetched issue. Since the idea is still expected to be vague at this stage, do **not** spawn specialist agents by default. Just:

1. Read `FILE`'s content for general understanding of the idea.
2. If the idea plausibly references specific existing code, files, or behavior, do a quick read of the obviously-relevant parts yourself (e.g. a targeted `grep`/file read) — enough to hold an informed dialogue, not a deep investigation.

Skip this entirely if the idea is simple enough that no code context would meaningfully change the conversation.

Once done, proceed to [dialogue.md](dialogue.md).
