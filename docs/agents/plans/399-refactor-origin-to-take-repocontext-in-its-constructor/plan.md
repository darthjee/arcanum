# Plan: Refactor Origin to take repoContext in its constructor

Issue: [399-refactor-origin-to-take-repocontext-in-its-constructor.md](../../issues/399-refactor-origin-to-take-repocontext-in-its-constructor.md)

## Overview

`Origin` (`core/lib/utils/git/Origin.js`) is a `core/`-only Node.js change, entirely within
the `node` agent's scope. See [node.md](node.md) for the full plan.
