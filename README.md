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

- Preview build: `npm run build:preview`
- Production build: `npm run build` (fails if backend URL is localhost/missing)

## CI Automation (GitHub Actions)

The repo includes `.github/workflows/extension-build.yml`.

- On pull request and push to `main`: automatic preview build.
- On manual run (`workflow_dispatch`): choose `preview` or `production`.
- Build artifacts are uploaded automatically (`apps/extension/dist`).

Set these repository variables in GitHub (`Settings` -> `Secrets and variables` -> `Actions` -> `Variables`):

- `EXTENSION_PREVIEW_BACKEND_URL` (example: `https://your-preview-backend.vercel.app`)
- `EXTENSION_PRODUCTION_BACKEND_URL` (example: `https://your-backend.vercel.app`)

## Install

[Chrome extension](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp)

## Contribution

Suggestions and pull requests are welcome.
