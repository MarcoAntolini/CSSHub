# CssHub

CssHub is a Chrome extension that syncs CSSBattle submissions to GitHub.

## Monorepo Layout

- `apps/extension`: Chrome extension
- `apps/backend`: Vercel OAuth backend (`/api/oauth/github/state`, `/api/oauth/github/exchange`)

## Development (Phase 1.5)

1. Configure backend (`apps/backend/.env.local`) from `apps/backend/.env.example`.
1. Configure extension (`apps/extension/.env.development.local`) from `apps/extension/.env.development.example`.
1. Run backend: `npm run dev:backend`.
1. Run extension build watch: `npm run dev:extension`.
1. Load unpacked extension from `apps/extension/dist`.

## Preview and Production

- Staging build: `npm run build:staging`
- Preview build (legacy): `npm run build:preview`
- Production build: `npm run build` (fails if backend URL is localhost/missing)

## CI Automation (GitHub Actions)

The repo includes `.github/workflows/extension-build.yml`.

- On pull request: automatic typecheck only.
- On push to `staging`: automatic staging build.
- On manual run (`workflow_dispatch`): choose `staging` or `production`.
- Build artifacts are uploaded automatically (`apps/extension/dist`).

Set these repository variables in GitHub (`Settings` -> `Secrets and variables` -> `Actions` -> `Variables`):

- `EXTENSION_STAGING_BACKEND_URL` (example: `https://your-staging-backend.vercel.app`)
- `EXTENSION_PRODUCTION_BACKEND_URL` (example: `https://your-backend.vercel.app`)

## GitHub + Vercel Setup (Step by Step)

1. Create a dedicated `staging` branch in GitHub.
1. In Vercel, import the repo with project root set to `apps/backend`.
1. In Vercel project settings, configure these env vars for both Preview and Production:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_EXTENSION_IDS`
- `UPSTASH_REDIS_REST_URL` (recommended)
- `UPSTASH_REDIS_REST_TOKEN` (recommended)

1. Push to `staging` once so Vercel creates the staging branch deployment URL.
1. Copy the stable Vercel branch URL for `staging`.
1. In GitHub repo variables, set:

- `EXTENSION_STAGING_BACKEND_URL` = staging branch URL
- `EXTENSION_PRODUCTION_BACKEND_URL` = production backend URL

1. Verify workflows:

- open PR -> only typecheck job runs
- push to `staging` -> staging extension artifact is generated
- run workflow manually with `production` target -> production artifact is generated

1. For Chrome Web Store release, use artifact `extension-dist-production`.

## Install

[Chrome extension](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp)

## Contribution

Suggestions and pull requests are welcome.
