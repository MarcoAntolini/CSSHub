# CssHub operations runbook

Lightweight ops guide for maintainers before and after scale. No Sentry/analytics in the product today.

**Support surface for users:** [GitHub Issues](https://github.com/MarcoAntolini/CSSHub/issues) (linked from README and Chrome Web Store support URL).

---

## User cannot sign in (GitHub / web OAuth)

Work through in order:

### 1. Extension build and identity

- Confirm **production** build (`npm run build:extension:prod` or CI `extension-dist-production`) with correct `VITE_OAUTH_BACKEND_BASE_URL` (no `localhost` in `dist/manifest.json` host permissions).
- **Stable extension id:** `EXTENSION_MANIFEST_KEY` set → production build → note id in `chrome://extensions` → must appear in backend `ALLOWED_EXTENSION_IDS`.
- **GitHub OAuth App:** Authorization callback URL must match `chrome.identity.getRedirectURL("github")` from that build (single callback per OAuth app).

### 2. OAuth backend health

```bash
OAUTH_HEALTH_URL=https://<your-prod-backend>/api/oauth/github/health npm run doctor:oauth
```

Expect `200` and `ok: true`. Check JSON:

| Field | Production expectation |
| --- | --- |
| `required.GITHUB_CLIENT_ID` | `true` |
| `required.GITHUB_CLIENT_SECRET` | `true` |
| `optional.ALLOWED_EXTENSION_IDS` | `true` (recommended) |
| `optional.UPSTASH_REDIS_REST_URL` | `true` (recommended) |
| `optional.UPSTASH_REDIS_REST_TOKEN` | `true` (recommended) |

If Redis vars are **false**, OAuth `state` and rate limits use **in-memory** fallback per instance (`apps/backend/lib/rateLimit.ts`, `lib/redis.ts`)—unsafe for multi-instance production.

### 3. Vercel / env

- Project root directory `apps/backend` (or monorepo layout per [backend README](../apps/backend/README.md)).
- Preview vs Production env sets both have GitHub + Redis + `ALLOWED_EXTENSION_IDS` for the extension ids you ship.
- GitHub repo variable `EXTENSION_PRODUCTION_BACKEND_URL` matches the URL embedded in store builds.

### 4. User-side checks

- PAT/device flow: token scopes include repo access for the selected repository.
- Activity log message: mapped codes (`AUTH_STATE_MISMATCH`, `AUTH_GITHUB_UNAUTHORIZED`, etc.)—not raw GitHub JSON.

---

## Rate limiting and Redis

- **Production:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on Vercel. `redisClient` is null without both (`apps/backend/lib/redis.ts`).
- **Verify:** `GET /api/oauth/github/health` → `optional.UPSTASH_REDIS_REST_*` both `true`.
- **Fallback:** Without Redis, `checkRateLimit` uses process memory (`memoryBuckets` in `rateLimit.ts`)—limits do not share across serverless instances and reset on cold start.
- **OAuth state:** Prefer Redis-backed state storage when available (see backend OAuth handlers); do not rely on memory in production.

---

## Rollback

Keep these before each store submission:

| Asset | What to keep |
| --- | --- |
| **Chrome Web Store** | Previous published `.zip` (e.g. `release/csshub-<prev>.zip`) and dashboard version number |
| **Vercel backend** | Note last known-good **deployment id** in Vercel → Deployments (Production). Roll back via “Promote to Production” on an older deployment if a bad OAuth change ships |
| **GitHub Release** | Tag and `csshub-*.zip` attached to the prior [Release](https://github.com/MarcoAntolini/CSSHub/releases) |

**Extension rollback:** Publish previous package in Chrome Web Store (or `% rollback` in dashboard if available). Users get the older version on auto-update delay.

**Backend rollback:** Promote previous Vercel deployment; no extension rebuild required if only backend logic/env regressed (unless `VITE_OAUTH_BACKEND_BASE_URL` itself changed).

---

## Related docs

- [`privacy-data-map.md`](./privacy-data-map.md) — data retention and activity log sanitization
- **`docs/internal/`** (gitignored) — release checklist, store listing draft, perf matrix, architecture notes; see `docs/internal/README.md` locally
- [`apps/backend/README.md`](../apps/backend/README.md) — deploy and env vars
- [`apps/extension/README.md`](../apps/extension/README.md) — CI artifacts and store zip
