# CssHub — Chrome extension

Sync [CSSBattle](https://cssbattle.dev) submissions to a GitHub repository from the browser.

Part of the [CssHub monorepo](../../README.md). End-user install and overview: [root README](../../README.md).

## Quick Start

From the **repository root**:

```bash
npm ci
cp apps/backend/.env.example apps/backend/.env.local
cp apps/extension/.env.development.example apps/extension/.env.development.local
npm run dev
```

Load the unpacked extension from **`apps/extension/dist/`** (not `public/`).

Requirements: **Node.js 20+**, **Google Chrome** (or another Chromium browser with Manifest V3).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Watch build to `dist/` (development mode) |
| `npm run build:prod` | Production bundle |
| `npm run build:staging` / `build:preview` / `npm run build:dev` | Other Vite modes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit tests) |

Root-level aliases (`npm run dev`, `npm run build:extension:prod`, etc.) are in the table below.

### Root scripts (from monorepo root)

| Command | Description |
| --- | --- |
| `npm run dev` | Backend + extension |
| `npm run dev:backend` / `npm run dev:extension` | One side only |
| `npm run build:extension:prod` | Production extension (`dist/`) |
| `npm run build:extension:staging` / `:preview` / `:dev` | Other Vite modes |
| `npm run typecheck` | All workspaces |
| `npm run doctor:oauth` / `npm run derive:manifest-key` | Helpers in `scripts/` |

Aliases: `npm run build:extension`, `npm run build:staging`, `npm run build:preview`, `npm run build:dev`.

## Configuration

Copy the env example that matches your target and fill in values:

- `.env.development.example` → `.env.development.local`
- `.env.staging.example`, `.env.preview.example`, `.env.production.example` as needed

Important variables:

- `VITE_GITHUB_CLIENT_ID` — public OAuth App client id (device flow and authorize URL).
- `VITE_OAUTH_BACKEND_BASE_URL` — CssHub Vercel backend used for **web** OAuth code exchange only (required for production builds; see [backend README](../backend/README.md)).
- `EXTENSION_MANIFEST_KEY` — optional for **dev/staging/preview** builds only; stabilizes unpacked extension id for OAuth. **Omit for production** (Chrome Web Store rejects `manifest.key`; the store assigns your public extension id).

## Web OAuth callback URL (extension id)

GitHub OAuth Apps allow **one** authorization callback URL per app.

**Local / staging unpacked builds:** set `EXTENSION_MANIFEST_KEY` in `.env.development.local` (or staging/preview), build, load unpacked, then register `chrome.identity.getRedirectURL("github")` on your GitHub OAuth App.

**Chrome Web Store:** do **not** set `EXTENSION_MANIFEST_KEY` in `.env.production.local`. Production builds omit `manifest.key`. After the store publishes the extension, copy its id from `chrome://extensions` and add it to backend `ALLOWED_EXTENSION_IDS`, then register that build’s OAuth redirect URL on GitHub.

## Security & data handling

- **GitHub access token** — After sign-in (web OAuth, device flow, or PAT), the token is kept in **`chrome.storage.session` only** (cleared on logout or browser session end). Settings, last submission preview, and an activity log (max **15** events) use **`chrome.storage.local`**. The token is sent to **api.github.com** / **github.com** to list repos, branches, and create commits. It is **not** sent to CssHub servers except during **web OAuth**: the extension posts the short-lived `code` + `state` + `redirectUri` to your configured **`VITE_OAUTH_BACKEND_BASE_URL`** so the **client secret** never ships inside the extension.
- **Activity log** — User-facing messages only; GitHub/API failures are mapped through `toUserSafeError` (no raw response bodies stored). See [`docs/privacy-data-map.md`](../../docs/privacy-data-map.md).
- **CSSBattle** — A content script runs on `cssbattle.dev` / `www.cssbattle.dev` play URLs to read submission data the user is viewing. That data is forwarded to the background worker for optional deduplication and GitHub sync.
- **Host permissions** — Declared for GitHub, CSSBattle, and (at build time) the OAuth backend origin; see `public/manifest.json` and `vite.config.ts` (backend origin is merged into `dist/manifest.json` on build).
- **Telemetry** — CssHub does not operate a separate analytics backend; routine errors and status may appear in the in-extension activity log (user-controlled settings).

For backend-side guarantees (OAuth state, rate limits, secrets), see the [backend README](../backend/README.md).

## CI and release builds

Workflow: [`.github/workflows/extension-build.yml`](../../.github/workflows/extension-build.yml).

- **Pull requests** — typecheck
- **Push to `staging`** — staging extension artifact
- **Manual `workflow_dispatch`** — choose `staging` or `production`

Artifacts include `apps/extension/dist`. Set GitHub Actions **Variables** (`EXTENSION_STAGING_BACKEND_URL`, `EXTENSION_PRODUCTION_BACKEND_URL`) so CI builds can point at your deployed OAuth backends.

## Vercel backend (production OAuth)

Deploy `apps/backend` to Vercel (project root = `apps/backend`), configure env vars, then set `VITE_OAUTH_BACKEND_BASE_URL` in extension builds to that deployment URL. Env variable list and health check: [backend README](../backend/README.md).

**Typical maintainer checklist**

1. Create a `staging` branch on GitHub if you use staging deployments.
2. In Vercel, import this repo with **root directory** `apps/backend`.
3. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_EXTENSION_IDS`, and (recommended) Upstash Redis on **Preview** and **Production**.
4. After the first staging deploy, copy the stable preview URL into the repo variable `EXTENSION_STAGING_BACKEND_URL`; set `EXTENSION_PRODUCTION_BACKEND_URL` to production.
5. Use the workflow artifact you need (`extension-dist-production` for store releases when applicable).
6. Zip for Chrome Web Store: unzip artifact into `dist/`, then from repo root `npm run package:extension:store` → `release/csshub-<version>.zip`. Store listing copy: `docs/internal/chrome-web-store-listing.md` (gitignored).

## Documentation

| Resource | Description |
|----------|-------------|
| [Root README](../../README.md) | Product overview, install, architecture |
| [Backend README](../backend/README.md) | OAuth API, Vercel deploy, health check |
| [`docs/privacy-data-map.md`](../../docs/privacy-data-map.md) | Extension storage and third-party hosts |
| [`docs/ops-runbook.md`](../../docs/ops-runbook.md) | OAuth login failures, rollback |
| [`docs/content-script-selectors.md`](../../docs/content-script-selectors.md) | CSSBattle DOM selectors (maintainer) |
