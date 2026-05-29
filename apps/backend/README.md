# CssHub — OAuth backend (Vercel)

Small serverless API used by the extension for **GitHub web OAuth** only: issue CSRF `state`, exchange `code` → `access_token` with the **client secret** held on the server.

Part of the [CssHub monorepo](../../README.md). Product overview: [root README](../../README.md).

## Quick Start

From the **repository root**:

```bash
npm ci
cp apps/backend/.env.example apps/backend/.env.local
# fill in GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_EXTENSION_IDS
npm run dev:backend
```

Runs `vercel dev` on `http://localhost:3000`.

### OAuth health check

```bash
curl http://localhost:3000/api/oauth/github/health
```

- `200` — required OAuth env vars are set
- `503` — missing configuration (`missingRequired`)

The response includes `stateStore: "redis"` when Upstash is configured, or
`stateStore: "signed-fallback"` when short-lived signed state tokens are used.

Or start backend + extension together: `npm run dev` from the repo root.

## Routes

Under `/api/oauth/github/`:

| Path | Method | Role |
| --- | --- | --- |
| `state` | `POST` | Returns `{ state, expiresInSec, githubClientId }` |
| `exchange` | `POST` | Validates `state`, checks `redirectUri`, exchanges `code` with GitHub |
| `health` | `GET` | Confirms required env vars are present |

## Environment

Copy `.env.example` to `.env.local` and configure:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_EXTENSION_IDS` (comma-separated Chrome extension ids; **strongly recommended** in preview/production so only your builds can complete web OAuth)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (recommended in preview/production for single-use OAuth `state`; without Redis, the backend uses short-lived signed state tokens so login still works across Vercel serverless instances)

## Deploying on Vercel

Use **one** of these layouts (both are supported via `vercel.json` in the repo):

### Option A (recommended): Root Directory = `apps/backend`

1. Vercel project **Root Directory** → **`apps/backend`**
2. Enable **Include source files outside of the Root Directory** (for `@csshub/shared`)
3. [`apps/backend/vercel.json`](vercel.json) runs `npm ci` from the monorepo root, builds `@csshub/shared`, then **`npm run vercel:prepare`** (copies `packages/shared/dist` → `lib/shared-dist/` inside this app). API routes import only from `lib/**` so Vercel’s `includeFiles: lib/**` bundles everything. Do **not** import `@csshub/shared` or `packages/shared/...` from `api/` — CI enforces this (`npm run check:backend-vercel`).
4. Add env vars; set extension `VITE_OAUTH_BACKEND_BASE_URL` to this deployment URL

### Option B: Root Directory = repository root

If the project root is the monorepo (function paths like `/var/task/apps/backend/...`), use the repo-root [`vercel.json`](../../vercel.json) instead. Same env vars apply.

Relative imports in this package use **`.js` extensions** (required for Node ESM in production). `vercel dev` may work without them locally; production does not.

For the full monorepo dev loop, CI variables, and OAuth callback notes, see the [extension README](../extension/README.md).

## Security & data handling

- **Client secret** — Only this service reads `GITHUB_CLIENT_SECRET`; the browser extension never contains it.
- **Authorization codes** — The extension sends the one-time `code` to `exchange`; the handler trades it for an access token with GitHub and returns the token **in the JSON response to the extension**. The backend **does not persist** user access tokens.
- **OAuth `state`** — Random, single-use values with a **short TTL** (about 10 minutes), stored in Redis when configured. Without Redis, the backend falls back to signed, expiring state tokens so serverless cold starts and instance changes do not break the login flow.
- **`redirectUri` allowlist** — Must be a Chrome extension identity redirect (`https://<extension-id>.chromiumapp.org/github`). When `ALLOWED_EXTENSION_IDS` is non-empty, the extension id parsed from the redirect must match the list.
- **Rate limiting** — IP-based limits on `state` and `exchange` reduce brute-force and abuse (see `lib/rateLimit.ts`).
- **CORS** — Responses include CORS headers appropriate for browser calls from the extension origin workflow.

For what the extension stores locally and which third-party hosts it talks to, see the [extension README](../extension/README.md).

## Documentation

| Resource | Description |
|----------|-------------|
| [Root README](../../README.md) | Product overview, architecture diagram |
| [Extension README](../extension/README.md) | Extension env, OAuth callback URL, CI |
| [`docs/ops-runbook.md`](../../docs/ops-runbook.md) | Login failures, Redis/rate limits, rollback |
| [`docs/privacy-data-map.md`](../../docs/privacy-data-map.md) | What the backend receives during web OAuth |
