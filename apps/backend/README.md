# CssHub Backend (Vercel)

Backend OAuth exchange for CssHub extension.

## Environment

Copy `.env.example` to `.env.local` and configure:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_EXTENSION_IDS` (comma-separated; recommended)
- `UPSTASH_REDIS_REST_URL` (optional but recommended in preview/prod)
- `UPSTASH_REDIS_REST_TOKEN` (optional but recommended in preview/prod)

## Local dev

Run from repo root:

```bash
npm run dev:backend
```

This starts `vercel dev` on `http://localhost:3000`.
