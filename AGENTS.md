# AGENTS.md

## Cursor Cloud specific instructions

### Overview

CssHub is a Chrome extension monorepo (npm workspaces) that syncs CSSBattle submissions to GitHub. Three packages:

- **`apps/extension`** — Chrome Extension (Manifest V3, Vite + React 19). The core product.
- **`apps/backend`** — Vercel serverless OAuth API (`vercel dev` on port 3000). Optional for local dev — the extension also supports GitHub device-flow and PAT auth without the backend.
- **`packages/shared`** — Shared TypeScript library (Zod schemas). Must be built before dependents.

### Commands (all from repo root)

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Build shared | `npm run build --workspace @csshub/shared` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test` |
| Dev (extension watch) | `npm run dev:extension` |
| Dev (backend + extension) | `npm run dev` |
| Build extension (dev) | `npm run build:dev` |
| Build extension (prod) | `npm run build:extension:prod` |
| Security scan | `npm run test:security` |
| Bundle budgets | `npm run check:bundle-budgets` |

### Non-obvious caveats

- **Build `@csshub/shared` first**: The shared package exports compiled `.js`/`.d.ts` from `dist/`. Run `npm run build --workspace @csshub/shared` before running typecheck or building the backend. The extension Vite config resolves to `src/index.ts` in development mode, so it works without building shared, but typecheck and backend require the build.
- **Env files**: Copy `apps/extension/.env.development.example` → `.env.development.local` and `apps/backend/.env.example` → `.env.local`. These files are gitignored. The extension builds fine with empty values (OAuth features won't work, but the build succeeds).
- **Backend requires Vercel CLI auth**: `npm run dev:backend` runs `vercel dev`, which requires Vercel CLI login. For local dev without a Vercel account, skip the backend — the extension works without it (use device flow or PAT auth).
- **Extension output**: After `npm run dev:extension` or `npm run build:dev`, load the unpacked extension from `apps/extension/dist/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
- **Watch mode**: `npm run dev:extension` runs Vite in watch mode. After editing source files, the `dist/` folder is rebuilt automatically, but you need to click the reload button on `chrome://extensions` to pick up changes in the loaded extension.
