import { itMatchesShellForMark } from '../../support/sharedExamples/githubIssueMarkParitySharedExamples.js';

// Parity test for the "github-issue-mark-split" migrated entrypoint
// (issue #589) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/589-migrate-github-issue-mark-subcommands-to-native-node-js-and-finish-the-entrypoint-migration/plan.md.
itMatchesShellForMark('split');
