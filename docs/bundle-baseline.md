# Extension bundle baseline

Production build: `VITE_OAUTH_BACKEND_BASE_URL=<backend> npm run build:extension:prod` then `npm run check:bundle-budgets`.

Budgets live in [`apps/extension/perf-budgets.json`](../apps/extension/perf-budgets.json). Operational SLOs: [`performance.md`](./performance.md).

## Before manualChunks split (2026-05-15, dev build)

Single shared chunk pulled React + sonner + app code together; popup and settings both paid for sonner.

| Artifact | Raw | Gzip |
|----------|-----|------|
| `popup.js` | 6.1 KB | 2.2 KB |
| `settings.js` | 28.0 KB | 7.8 KB |
| `background.js` | 25.7 KB | 8.8 KB |
| `contentScript.js` | 5.4 KB | 2.3 KB |
| `assets/eventTone-*.js` (shared) | 229 KB | **71 KB** |

Popup HTML preloaded the shared chunk (included sonner even though popup used inline errors only).

## After Phase 4 (production build, 2026-05-15)

`manualChunks` in [`apps/extension/vite.config.ts`](../apps/extension/vite.config.ts): `vendor-react`, `vendor-sonner`, `vendor` (zod + misc). Popup entry no longer imports sonner; settings loads `vendor-sonner` only.

| Artifact | Raw | Gzip | Notes |
|----------|-----|------|-------|
| `popup.js` | 7.2 KB | **2.7 KB** | No sonner chunk on popup.html |
| `settings.js` | 31.3 KB | 9.0 KB | Loads sonner vendor + CSS |
| `background.js` | 26.2 KB | 8.9 KB | Unchanged order of magnitude |
| `contentScript.js` | 5.3 KB | 2.3 KB | Unchanged |
| `assets/vendor-react-*.js` | 185 KB | 57.8 KB | React + react-dom |
| `assets/vendor-sonner-*.js` | 33 KB | 9.3 KB | Settings only |
| `assets/vendor-*.js` | 58 KB | 14.3 KB | Primarily zod |
| `assets/schemas-*.js` (`@csshub/shared`) | 2.6 KB | 1.0 KB | Shared Zod contracts |
| `assets/messaging-*.js` | 1.9 KB | 1.0 KB | UI → background client |

### Goals vs results

| Goal | Result |
|------|--------|
| Popup gzip ≤ 4 KB | **2.7 KB** |
| Popup avoids sonner vendor chunk | **Yes** — `popup.html` has no `vendor-sonner` preload |
| Shared vendor gzip ≤ 55 KB or sonner isolated | Sonner isolated; largest chunk is `vendor-react` at 57.8 KB (budget 60 KB) |
| No regression on `background.js` / `contentScript.js` | Within ~0.1 KB gzip of prior baseline |

## Regenerating this table

```bash
VITE_OAUTH_BACKEND_BASE_URL=https://your-oauth-backend.example.com npm run build:extension:prod
npm run check:bundle-budgets
```

CI runs the same budgets in [`.github/workflows/quality-gates.yml`](../.github/workflows/quality-gates.yml) after `build:extension:prod`.
