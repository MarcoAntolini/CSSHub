# ADR 0005: Layered capture and Sync validation

## Status

Accepted

## Context

Submission quality gates span the content script (DOM capture) and the background Sync worker (GitHub commit). A single check at either layer is insufficient: extension upgrades roll out gradually, race conditions can leave fields empty between capture and ingest, and future callers might invoke Sync with incomplete payloads.

CssHub needs a deliberate **defense-in-depth** pattern without duplicating user-facing failure modes.

## Decision

Required Submission fields are validated in two layers with distinct outcomes:

| Layer | Location | Missing preview (example) | User outcome |
|-------|----------|---------------------------|--------------|
| Capture | Content script (`detectCaptureIssues`) | Block message; no Submission created | Failed Capture Attempt — `CAPTURE_FAILED`, in-page retry prompt |
| Sync | `processCssbattleSubmission` | Accepted path blocked before GitHub | Skipped Submission — `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` |

The same pattern applies conceptually to other required capture fields at layer 1 only. Sync retains **preview** as the one repeated gate because it was historically validated at commit time and remains the highest-risk field for race/extension skew.

Layers must not contradict product language:

- Layer 1 failures are never labeled as Skipped Submissions.
- Layer 2 preview skips assume capture normally succeeded; messaging tells the user to retry from the CSSBattle tab.

## Rejected alternatives

**Sync-only validation.** Users waited through evaluation only to learn DOM capture failed; indistinguishable from threshold skips (superseded by ADR 0001).

**Capture-only validation with Sync preview check removed.** Older extension versions and direct test harness calls could commit without `user.png`, breaking Battle Archive completeness.

**Identical error copy at both layers.** Would blur Failed Capture Attempts and Skipped Submissions; retry guidance differs (fix page/extensions vs re-submit after preview renders).

## Consequences

- ADR 0001 owns the capture boundary; ADR 0004 owns Sync ordering including the preview branch.
- `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` should remain in the schema even when capture gating is universal in current builds.
- Activity Log may theoretically show both `CAPTURE_FAILED` and later `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` for different attempts on the same Target; they represent different layers and attempts.
- New required fields should default to capture-layer blocking; add a Sync-layer repeat only when backward compatibility or async population demands it.
- Related: ADR 0001 (capture boundary), ADR 0004 (Sync ordering).
