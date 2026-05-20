# CssHub — OAuth backend (Vercel)

Small serverless API used by the extension for **GitHub web OAuth** only: issue CSRF `state`, exchange `code` → `access_token` with the **client secret** held on the server.

Routes (under `/api/oauth/github/`):

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
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (recommended in preview/production for OAuth `state`; without Redis, state is kept in **process memory** and is less suitable for multi-instance or cold-start reuse)

## Local development

From the **repository root**:

```bash
npm run dev
```

or backend only:

```bash
npm run dev:backend
```

This runs `vercel dev` on `http://localhost:3000`.

### OAuth health check

```bash
curl http://localhost:3000/api/oauth/github/health
```

- `200` — required OAuth env vars are set
- `503` — missing configuration (`missingRequired`)

## Deploying on Vercel

Use **one** of these layouts (both are supported via `vercel.json` in the repo):

### Option A (recommended): Root Directory = `apps/backend`

1. Vercel project **Root Directory** → **`apps/backend`**
2. Enable **Include source files outside of the Root Directory** (for `@csshub/shared`)
3. [`apps/backend/vercel.json`](vercel.json) runs `npm ci` from the monorepo root and includes `lib/**` in each function bundle
4. Add env vars; set extension `VITE_OAUTH_BACKEND_BASE_URL` to this deployment URL

### Option B: Root Directory = repository root

If the project root is the monorepo (function paths like `/var/task/apps/backend/...`), use the repo-root [`vercel.json`](../../vercel.json) instead. Same env vars apply.

Relative imports in this package use **`.js` extensions** (required for Node ESM in production). `vercel dev` may work without them locally; production does not.

For the full monorepo dev loop, CI variables, and OAuth callback notes, see the [extension README](../extension/README.md) (maintainer sections at the bottom).

## Security & data handling

- **Client secret** — Only this service reads `GITHUB_CLIENT_SECRET`; the browser extension never contains it.
- **Authorization codes** — The extension sends the one-time `code` to `exchange`; the handler trades it for an access token with GitHub and returns the token **in the JSON response to the extension**. The backend **does not persist** user access tokens.
- **OAuth `state`** — Random, single-use values with a **short TTL** (about 10 minutes), stored in Redis when configured, or in-memory in local dev without Redis.
- **`redirectUri` allowlist** — Must be a Chrome extension identity redirect (`https://<extension-id>.chromiumapp.org/github`). When `ALLOWED_EXTENSION_IDS` is non-empty, the extension id parsed from the redirect must match the list.
- **Rate limiting** — IP-based limits on `state` and `exchange` reduce brute-force and abuse (see `lib/rateLimit.ts`).
- **CORS** — Responses include CORS headers appropriate for browser calls from the extension origin workflow.

For what the extension stores locally and which third-party hosts it talks to, see the [extension README](../extension/README.md).
