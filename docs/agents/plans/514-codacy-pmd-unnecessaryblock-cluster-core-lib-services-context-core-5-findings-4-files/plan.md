# Plan: Codacy: PMD UnnecessaryBlock cluster — core/lib/services, context, core (5 findings, 4 files)

Issue: [514_codacy-pmd-unnecessaryblock-cluster-core-lib-services-context-core-5-findings-4-files.md](../issues/514-codacy-pmd-unnecessaryblock-cluster-core-lib-services-context-core-5-findings-4-files.md)

## Overview

Verification-only — no source changes. The 4 files this issue lists (`core/lib/context/RepoContextFactory.js`, `core/lib/core/dispatcher.js`, `core/lib/services/IssueStateService.js`, `core/lib/services/PrMonitor.js`) are already excluded from PMD's `UnnecessaryBlock` check by the consolidated `.codacy.yml` exclusion list added in commit `47f2422` (PR #529, fixing #509), which explicitly resolves #514 too. This plan just confirms that exclusion and independently verifies there are no real lone-block violations underneath it.

See [node.md](node.md) for the full plan.
