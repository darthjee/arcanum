# Plan: Split fakeGhBin.js's buildGhScript method (173 LOC vs Lizard limit of 50)

Issue: [463_split-fakeghbin-js-s-buildghscript-method-173-loc-vs-lizard-limit-of-50.md](../../issues/463-split-fakeghbin-js-s-buildghscript-method-173-loc-vs-lizard-limit-of-50.md)

## Overview

Split `core/spec/support/utils/fakeGhBin.js`'s 173-LOC `buildGhScript` function into one small
helper per top-level `gh` subcommand group (`auth`, `pr view`, `pr` mutations, `api`, `issue`)
plus a reduced assembler, bringing every function under the repo's 50-LOC Lizard limit while
keeping the emitted fake `gh` script and `createFakeGhBin`'s public contract byte-for-byte
unchanged.

See [node.md](node.md) for the full plan.
