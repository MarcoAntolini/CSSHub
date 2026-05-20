# CssHub Privacy Data Map

This document maps data handled by CssHub and where it is stored or transmitted.

## Data Inventory

- **GitHub access token**
  - Source: OAuth web/device flow or PAT login
  - Storage: `chrome.storage.session` (`csshub_github_token_v1`)
  - Retention: session-scoped; cleared on logout/session reset
- **Auth status (`isAuthenticated`, `username`, `method`)**
  - Source: derived after successful auth
  - Storage: `chrome.storage.local` (`csshub_state_v1`)
  - Retention: persisted locally until logout/reset
- **Extension settings (`threshold`, repo/branch, notifications, README mode`)**
  - Source: user actions in settings UI
  - Storage: `chrome.storage.local`
  - Retention: persisted locally
- **Last submission payload (challenge metadata, CSS code, optional images)**
  - Source: CSSBattle content flow
  - Storage: `chrome.storage.local`
  - Retention: persisted locally; overwritten by newer submission
- **Last ingestion result and recent events**
  - Source: background ingestion pipeline
  - Storage: `chrome.storage.local`
  - Retention: persisted locally; events clearable via `Clear log`

## External Data Flows

- **GitHub API (`api.github.com`)**
  - Used for auth user lookup, repositories, branches, and content commits.
  - Token sent as auth credential in request headers.
- **GitHub OAuth web auth**
  - Browser-based authorization flow via GitHub auth endpoints.
- **CssHub backend OAuth exchange**
  - Receives OAuth code/state/redirect during web OAuth exchange; returns access token.

## Minimization and Controls

- Access token is not persisted in local storage; session storage only.
- Logout clears token and resets auth status.
- Activity log is user-facing and sanitized; no raw secret payloads intended.
- No user secret literals should appear in source, docs, or build artifacts (`npm run test:security`).

## Related documents

- Public privacy policy: [`privacy-policy.md`](./privacy-policy.md) / https://marcoantolini.github.io/CSSHub/privacy-policy.html
- Chrome Web Store listing and permission justifications: [`chrome-web-store-listing.md`](./chrome-web-store-listing.md)

## Pre-release Verification

- Run `npm run test:security` and confirm no secret-like matches.
- Manually verify logout removes authenticated state in settings/popup.
- Verify privacy statements in README, privacy policy, and Chrome Store listing match this map.
