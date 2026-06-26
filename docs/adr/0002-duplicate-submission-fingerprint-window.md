# ADR 0002: Duplicate submission fingerprint and time window

## Status

Accepted

## Context

CSSBattle can fire multiple submit events in quick succession: double-clicks, keyboard shortcuts retried while stats are still updating, or content-script re-entry after a partial page refresh. Each event would otherwise reach Sync, hit GitHub for metrics and file builds, and flood the Activity Log with identical outcomes.

CssHub needs a cheap, local dedupe step that distinguishes a true re-submit of the same attempt from a later intentional retry with changed code or score.

## Decision

Before any GitHub work, Sync treats a Submission as a **Duplicate Submission** when all of the following hold:

1. A prior Submission fingerprint exists in storage (`lastSubmissionFingerprint`).
2. The current fingerprint matches that baseline (same challenge identity, mode, score, match %, character count, and code).
3. `submittedAt` is within **45 seconds** of the stored prior Submission.

Duplicate Submissions:

- Emit `SYNC_SKIPPED_DUPLICATE` with a warn tone
- Do **not** advance the duplicate baseline (fingerprint and `lastSubmission` stay on the prior non-duplicate attempt)
- Skip all GitHub reads and commits

Non-duplicate outcomes (including errors) advance the baseline so the next attempt compares against the latest ingested Submission.

Fingerprints use a compact JSON hash of the fields above, not a full payload hash, to keep storage small and comparisons stable.

## Rejected alternatives

**Commit-time dedupe only (compare against repository files).** Too late: wastes GitHub API calls, slower feedback, and still creates noisy Activity Log entries for rapid double-submits.

**Unbounded fingerprint match (no time window).** Would incorrectly skip legitimate retries when a user re-submits the same code minutes later after tweaking settings or returning to a Target.

**Dedupe on challenge id alone.** Would hide distinct attempts that share a Target but differ in code, score, or match %.

## Consequences

- Rapid identical submits feel instant and local; users see `DUP` badge feedback without network churn.
- The 45-second window is a heuristic; changing it affects how aggressively CssHub collapses repeat events.
- Duplicate skips still count as ingest outcomes and clear `lastCaptureFailure` (see ADR 0001).
- Tests in `syncSubmission.test.ts` lock fingerprint equality and window boundaries.
- Related: ADR 0001 (capture boundary), ADR 0004 (pipeline ordering).
