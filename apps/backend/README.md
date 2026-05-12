# CssHub OAuth Backend

Vercel serverless backend for GitHub OAuth token exchange.

## Endpoints

- `POST /api/oauth/github/state`
- `POST /api/oauth/github/exchange`

## Local dev

1. Copy `.env.example` to `.env.local` inside `apps/backend`
2. Fill required env variables
3. Run:

```bash
npm run dev:backend
```
