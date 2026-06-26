# ADR 0001: Block incomplete capture before Sync

## Status

Accepted

## Context

CssHub captures CSSBattle play-page DOM data when the user submits a Solution. Required fields include challenge metadata, score, match percentage, editor code, target image, and result preview image.

Previously, missing values flowed through as `null` or fallbacks. Sync could skip late (for example `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` at commit time), which felt like a Skipped Submission rather than a capture problem. Users had no in-page retry guidance when extensions or styles hid page sections.

Score handling was ambiguous: unavailable DOM markers (dash placeholders, empty stats boxes) were treated like a scored zero, so users saw threshold or invalid-score skips instead of capture retry guidance.

## Decision

Incomplete DOM capture becomes a **Failed Capture Attempt** before Sync starts. Preview image is required upstream in the content script; no `cssbattleSubmission` message is sent when required capture data is missing.

**Unavailable vs zero score:** When the page shows unavailable markers (`isScoreUnavailableInDocument`), capture fails with a `last-score` issue. Genuine score **0** and match **0** are valid captured values that reach Sync and are skipped there as `SYNC_SKIPPED_INVALID_SCORE` (see ADR 0004). Capture blocks unreadable stats; Sync evaluates readable zeros.

Failed Capture Attempts:

- Show an in-page retry prompt on the CSSBattle tab
- Set a warn-level `FAIL` badge
- Record `CAPTURE_FAILED` in the Activity Log
- Persist `lastCaptureFailure` for the popup **Last activity** card
- Optionally notify when desktop notifications are enabled

Any later Submission that reaches ingest (committed, skipped, duplicate, or error) clears `lastCaptureFailure`.

## Rejected alternatives

- **Permissive capture** with nullable payload fields and late skip reasons only (`SYNC_SKIPPED_PREVIEW_UNAVAILABLE`, etc.). This conflated capture failures with Skipped Submissions and delayed user feedback until after Sync evaluation.
- **Unavailable score treated as zero** at capture time. That delayed retry guidance until Sync and mislabeled DOM read failures as Skipped Submissions.

## Consequences

- `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` remains in Sync as defense-in-depth (see ADR 0005).
- Activity Log and popup gain a pre-sync outcome type distinct from Skipped Submissions.
- Settings include a static compatibility note about page-modifying extensions.
- Related: ADR 0004 (Sync pipeline), ADR 0005 (layered validation).
