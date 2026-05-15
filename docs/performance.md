# CssHub performance

Targets and checks for extension load time, sync latency, and bundle size before Chrome Web Store release.

## SLOs (v0.1)

| Metric | Target | Verification |
|--------|--------|--------------|
| `popup.js` gzip | ≤ 12 KB | `npm run check:bundle-budgets` |
| `contentScript.js` gzip | ≤ 4 KB | bundle budgets |
| `background.js` gzip | ≤ 12 KB | bundle budgets |
| `settings.js` gzip | ≤ 15 KB | bundle budgets |
| Vendor chunks (gzip) | per `perf-budgets.json` | bundle budgets |
| Submit → commit (mocked GitHub) | &lt; 8 s | Playwright `submission-perf.spec.ts` |
| Submit → skip (below threshold) | &lt; 500 ms | Vitest `syncSubmission.test.ts` |
| OAuth health (preview/prod) | &lt; 2 s | `npm run doctor:oauth` |

## Local commands

```bash
# Production build + bundle gate
VITE_OAUTH_BACKEND_BASE_URL=https://your-oauth-backend.example.com npm run build:extension:prod
npm run check:bundle-budgets

# Unit tests (includes perf-oriented sync + DOM stats tests)
npm run test

# E2E (builds dev dist, then smoke + submission perf)
npm run test:e2e
```

## Content script timing

After submit click, CssHub:

1. Waits for post-submit stats (`750ms` settle, then poll every `300ms`, max `20s`).
2. Captures preview screenshot in parallel with stats polling.
3. Sends `cssbattleSubmission` to the service worker.

Tune these only with manual traces on cssbattle.dev; document changes here.

## Sync path (service worker)

On accepted submissions with README mode enabled, CssHub fetches the branch tree once for README index + commit (no duplicate recursive tree fetch).

## Manual Chrome Web Store matrix

Run on an **unpacked production** build (`apps/extension/dist`) in a clean profile.

| Step | Pass criteria |
|------|----------------|
| Install from `dist/` | No dev URLs in manifest host permissions |
| Cold popup | Opens in &lt; 1 s perceived |
| Settings tab | Loads in &lt; 2 s; activity log scrolls smoothly |
| CSSBattle submit (repo configured) | Sync feedback within ~15 s on typical network |
| Below-threshold submit | Skips quickly; log shows threshold reason |
| Double submit | No duplicate commits within 45 s |
| Service worker idle | Next submit still works after ~1 min idle |
| Logout / login | No storage bloat or slowdown |

Record results in `docs/performance-signoff-YYYY-MM-DD.md` before store submission.

## OAuth backend

Not on the hot sync path. Before release:

- `npm run doctor:oauth` against preview/production URL
- Redis rate limiting enabled in production (not in-memory fallback)

## Related

- [`release-readiness-checklist.md`](./release-readiness-checklist.md)
- [`architecture-review.md`](./architecture-review.md) — bundle baseline table
