# CssHub — Chrome extension

Sync [CSSBattle](https://cssbattle.dev) submissions to a GitHub repository from the browser.

## Requirements

- Node.js 20+ (same as the rest of the monorepo)
- Google Chrome (or another Chromium browser that supports Manifest V3)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Watch build to `dist/` (development mode) |
| `npm run build:prod` | Production bundle |
| `npm run build:staging` / `build:preview` / `npm run build:dev` | Other Vite modes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit tests) |

## Configuration

Copy the env example that matches your target and fill in values:

- `.env.development.example` → `.env.development.local`
- `.env.staging.example`, `.env.preview.example`, `.env.production.example` as needed

Important variables:

- `VITE_GITHUB_CLIENT_ID` — public OAuth App client id (device flow and authorize URL).
- `VITE_OAUTH_BACKEND_BASE_URL` — CssHub Vercel backend used for **web** OAuth code exchange only (required for production builds; see [backend README](../backend/README.md)).
- `EXTENSION_MANIFEST_KEY` — optional; stabilizes extension id for a fixed GitHub OAuth callback URL.

After `npm run dev` or a production build, load the unpacked extension from **`dist/`** (not `public/`).

## Security & data handling

- **GitHub access token** — After sign-in (web OAuth, device flow, or PAT), the token is kept in **extension `chrome.storage` only**. It is sent to **api.github.com** / **github.com** to list repos, branches, and create commits. It is **not** sent to CssHub servers except during **web OAuth**: the extension posts the short-lived `code` + `state` + `redirectUri` to your configured **`VITE_OAUTH_BACKEND_BASE_URL`** so the **client secret** never ships inside the extension.
- **CSSBattle** — A content script runs on `cssbattle.dev` / `www.cssbattle.dev` play URLs to read submission data the user is viewing. That data is forwarded to the background worker for optional deduplication and GitHub sync.
- **Host permissions** — Declared for GitHub, CSSBattle, and (at build time) the OAuth backend origin; see `public/manifest.json` and `vite.config.ts` (backend origin is merged into `dist/manifest.json` on build).
- **Telemetry** — CssHub does not operate a separate analytics backend; routine errors and status may appear in the in-extension activity log (user-controlled settings).

For backend-side guarantees (OAuth state, rate limits, secrets), see the [backend README](../backend/README.md).

## Monorepo development (from repository root)

Clone the repo, then:

1. Copy `apps/backend/.env.example` → `apps/backend/.env.local`.
2. Copy `apps/extension/.env.development.example` → `apps/extension/.env.development.local`.
3. Run `npm run dev` — starts the OAuth backend (`vercel dev`) and the extension watch build.
4. Load **unpacked** from `apps/extension/dist`.

### Useful root scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Backend + extension |
| `npm run dev:backend` / `npm run dev:extension` | One side only |
| `npm run build:extension:prod` | Production extension (`dist/`) |
| `npm run build:extension:staging` / `:preview` / `:dev` | Other Vite modes |
| `npm run typecheck` | All workspaces |
| `npm run doctor:oauth` / `npm run derive:manifest-key` | Helpers in `scripts/` |

Aliases: `npm run build:extension`, `npm run build:staging`, `npm run build:preview`, `npm run build:dev`.

## Web OAuth callback URL (stable extension id)

GitHub OAuth Apps allow **one** authorization callback URL per app, so the extension id should stay stable for browser sign-in.

1. Set `EXTENSION_MANIFEST_KEY` in the appropriate `apps/extension/.env.*.local` file.
2. Build so the key is written into `dist/manifest.json`.
3. In CssHub settings, confirm the redirect URL from `chrome.identity.getRedirectURL("github")`.
4. Register that exact URL on your GitHub OAuth App as the **Authorization callback URL**.

## CI and release builds

Workflow: `.github/workflows/extension-build.yml`.

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
