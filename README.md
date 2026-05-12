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

## Install

[Chrome extension](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp)

## Contribution

Suggestions and pull requests are welcome.
