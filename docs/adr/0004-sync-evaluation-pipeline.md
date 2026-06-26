# ADR 0004: Sync evaluation pipeline

## Status

Accepted

## Context

After capture succeeds, a Submission enters **Sync**: CssHub evaluates whether it should reach GitHub and, if so, whether it improves what is already on the Selected Repository branch. Users see different product language and UI tones for "accepted but not committed", "skipped below threshold", "kept best result", and "committed".

The pipeline must be ordered so cheap local checks run before GitHub API calls, and so outcome codes map cleanly to Activity Log entries, popup badges, and notifications.

## Decision

Sync evaluation in `processCssbattleSubmission` follows this fixed order:

1. **Normalize** character count on the payload.
2. **Threshold gate.** A Submission is **Accepted** when Last score is a positive finite number (≤ 100 000) *and* match % is positive *and* match % ≥ user threshold. Otherwise it is not accepted (`SYNC_SKIPPED_INVALID_SCORE` when score/match are zero or invalid; `SYNC_SKIPPED_THRESHOLD` when below threshold).
3. **Duplicate gate** (ADR 0002). If duplicate → `SYNC_SKIPPED_DUPLICATE`; stop before GitHub.
4. **Setup gates** (only when accepted). Missing GitHub auth → `SYNC_AUTH_REQUIRED`. Missing Selected Repository → `SYNC_REPO_REQUIRED`. Missing preview image → `SYNC_SKIPPED_PREVIEW_UNAVAILABLE` (defense-in-depth; see ADR 0005).
5. **Improvement gate.** Read best saved metrics for this Target on the branch. If present and not strictly improved (higher match % wins; tie-break on score) → `SYNC_SKIPPED_NOT_IMPROVED`.
6. **Commit.** Build files, optionally update root README with merged Battle Metadata, commit → `SYNC_COMMITTED`.

Terminology (from `CONTEXT.md`):

- **Accepted Submission** — passed threshold; may still not commit due to setup, preview, or not-improved gates.
- **Skipped Submission** — reached Sync and was intentionally not committed (threshold, duplicate, not improved, invalid score, preview unavailable).
- **Commit** — GitHub write succeeded.

Genuine score **0** / match **0** are valid captured values that Sync skips via `SYNC_SKIPPED_INVALID_SCORE`. Dash markers or empty stats at capture time are **Failed Capture Attempts**, not invalid-score skips (see ADR 0001).

## Rejected alternatives

**Commit first, evaluate afterward.** Would create noisy commits and revert churn on double-submits and below-threshold attempts.

**Single "sync failed" outcome for all non-commits.** Hides whether the user should fix auth, raise their score, or accept that their best is already saved.

**Improvement check before threshold.** Would fetch repository metrics for attempts CssHub would never commit, wasting API quota.

**Treat accepted and committed as the same user-facing state.** Popup and Activity Log need to distinguish "good enough but blocked on setup" from "written to GitHub".

## Consequences

- Event codes in `syncEventCodes.ts` are the stable contract for UI tone mapping (`success` / `warn` / `error`).
- `ingestSubmission.ts` persists `lastIngestion`, updates duplicate baseline per ADR 0002, and clears `lastCaptureFailure` on any ingest path.
- Badge mapping: `OK` commit, `BEST` not improved, `DUP` duplicate, `WAIT` accepted-but-blocked, `SKIP` other skips, `ERR` errors.
- Pipeline order is regression-tested in `syncSubmission.test.ts` and `ingestSubmission.test.ts`.
- Related: ADR 0001 (capture boundary), ADR 0002 (duplicate gate), ADR 0005 (preview defense-in-depth).
