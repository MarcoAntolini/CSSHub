# Chrome Web Store listing copy

Draft text for CssHub v1.0 submission. Paste into the Developer Dashboard fields. Aligns with [`privacy-data-map.md`](./privacy-data-map.md) and [`privacy-policy.md`](./privacy-policy.md).

**Privacy policy URL:** https://marcoantolini.github.io/CSSHub/privacy-policy.html  
(Enable GitHub Pages from `/docs` — see privacy policy § Publishing.)

---

## Screenshots (1280×800 or 640×400)

Source assets in [`docs/screenshots/`](../screenshots/). Resize/crop to store dimensions before upload.

| Order | File | Shows |
| --- | --- | --- |
| 1 | `popup.png` | CSSBattle play page + popup (`committed`, sync target) |
| 2 | `settings.png` | Signed in, repo/branch, README mode |
| 3 | `activity-log.png` | Activity log (committed, skipped outcomes) |
| 4 | `github.png` | Resulting GitHub commit and challenge folder |

---

## Single purpose

CssHub syncs CSSBattle challenge submissions from the official play experience into a GitHub repository the user selects, so their solutions are versioned and backed up like normal source code.

The extension does not modify unrelated websites, serve ads, or provide a separate social network or analytics product.

---

## Permission justifications

Map each manifest permission to a concrete user benefit. Source: [`apps/extension/public/manifest.json`](../../apps/extension/public/manifest.json) (production builds also add the OAuth backend origin via the Vite build).

### `storage`

**Why:** Save your chosen repository and branch, notification preference, last submission preview, and a short activity log (up to 15 events) on your device. Store the GitHub access token in **session** storage only so it is cleared when you sign out or the browser session ends.

**User benefit:** Settings and sync status persist between popup visits without a CssHub cloud account.

### `activeTab`

**Why:** When you sync from the popup, CssHub may capture a screenshot of the **currently active** CSSBattle play tab to attach an optional preview image to the GitHub commit.

**User benefit:** Optional visual preview of your solution in the repo without asking for access to every tab in the browser.

### `tabs`

**Why:** Find the active CSSBattle tab for capture and messaging; open GitHub OAuth or device-flow pages in a new tab when you choose web or device sign-in; open your repository on GitHub from the popup.

**User benefit:** Reliable sync from the tab you are playing on and a smooth sign-in flow.

### `identity`

**Why:** Run GitHub’s browser OAuth redirect (`chrome.identity.launchWebAuthFlow`) so you can sign in without pasting a personal access token.

**User benefit:** One-click GitHub sign-in using GitHub’s standard OAuth page.

### `scripting`

**Why:** Inject the content script on demand when a play tab was opened before the extension loaded, and run in-tab helpers to measure the battle preview element for screenshot cropping.

**User benefit:** Sync still works if you reload CSSBattle or open a tab before installing CssHub.

### `notifications`

**Why:** Show optional desktop notifications when a sync succeeds or fails (only if you enable notifications in settings).

**User benefit:** Know sync finished without keeping the popup open.

---

## Host permission justifications

Production builds include your deployed OAuth backend origin (for example `https://css-hub-extension.vercel.app/*`). Staging/preview builds use the URL from `VITE_OAUTH_BACKEND_BASE_URL`.

| Host pattern | Why | User benefit |
| --- | --- | --- |
| `https://api.github.com/*` | List repos/branches and create commits for sync | Your battles land in the GitHub repo you picked |
| `https://github.com/*` | OAuth authorize, device flow, and opening your repo in the browser | Sign in with GitHub and open synced code on GitHub |
| `https://cssbattle.dev/*` | Content script on play pages; read submission data from the page you are solving | Sync works on the official CSSBattle site |
| `https://www.cssbattle.dev/*` | Same as above for the `www` host | Same experience on both CSSBattle domains |
| `https://<oauth-backend>/*` | Exchange web OAuth `code` for an access token; backend holds the client secret | Secure web sign-in without embedding secrets in the extension |

---

## Data safety form (Chrome Web Store)

Complete **Store listing → Privacy** in the Developer Dashboard. Answers must match [`privacy-data-map.md`](./privacy-data-map.md) and [`privacy-policy.md`](./privacy-policy.md).

### Top-level questions

| Dashboard question | Answer | Notes |
| --- | --- | --- |
| Does your product collect or share any of the required user data types? | **Yes** | Required for sync and GitHub sign-in |
| Is all of the user data collected by your product encrypted in transit? | **Yes** | HTTPS to GitHub, CSSBattle, and the OAuth backend |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Sign out, clear activity log, uninstall; synced content lives in the user’s own GitHub repo |
| Has a privacy policy URL been provided? | **Yes** | https://marcoantolini.github.io/CSSHub/privacy-policy.html |

### Data types to declare (check only what applies)

| Data type (Chrome category) | Collected? | Shared? | Purpose | Notes |
| --- | --- | --- | --- | --- |
| **Personal info → User IDs** | Yes | Yes (GitHub) | App functionality, Account management | GitHub username after sign-in |
| **Personal info → Other** (if offered) | No | — | — | No email, name, or address collected by CssHub |
| **User activity → App interactions** | Yes | Yes (GitHub) | App functionality | Submission metadata, CSS, optional preview images sent to the user’s repo |
| **App activity → Other user-generated content** | Yes | Yes (GitHub) | App functionality | Commits/files created in the user-selected repository |
| **App activity → App interactions** (local log) | Yes | No | App functionality | Up to 15 sync events in local extension storage only |
| **Financial, health, location, web browsing history** | No | — | — | Not collected |
| **Device or other IDs** | No | — | — | No advertising ID or CssHub device fingerprint |

For each **collected** type above, set **ephemeral** / **required** as appropriate: GitHub token is **not** persisted in `local` storage (session only); settings and log are **optional** to the product but stored locally until the user clears them.

### Third-party sharing

| Party | What is shared | Why |
| --- | --- | --- |
| **GitHub** | Token (API auth), username, repo/branch choice, submission payloads for commits | Core sync and authentication |
| **CssHub OAuth backend (Vercel)** | OAuth `code`, `state`, `redirectUri` during web sign-in only | Exchange code for token; client secret stays on server |

| Question | Answer |
| --- | --- |
| Is this data sold to third parties? | **No** |
| Is this data used for tracking purposes? | **No** (no CssHub analytics or ads) |

**Storage disclosure (free-text / policy):** Data is stored **on the user’s device** in Chrome extension storage (`local` + `session`). The GitHub token is **session-only**. Submission previews and settings stay local until logout, clear log, or uninstall. CssHub does not host a user database of battles.

**Privacy policy URL:** https://marcoantolini.github.io/CSSHub/privacy-policy.html

---

## Short description (store, ≤ 132 chars)

**Copy-paste (131 chars):**

```text
Sync CSSBattle solutions to your GitHub repo—play on cssbattle.dev, commit automatically, no copy-paste.
```

Mentions only **CSSBattle** and **GitHub** (no other platforms or backends in the short blurb).

---

## Detailed description (store)

**Copy-paste:**

```text
CssHub syncs your CSSBattle submissions to a GitHub repository you choose.

How it works:
• Play challenges on cssbattle.dev (or www.cssbattle.dev)
• Sign in with GitHub and pick a repo and branch
• Sync passes as commits with optional preview images

Built for CSSBattle and GitHub only—the extension runs on CSSBattle play pages and talks to GitHub (plus a small OAuth helper for secure web sign-in). Your GitHub token stays in session storage on your device. Settings and a short activity log stay in local extension storage. CssHub does not run analytics or store your battles on CssHub servers.

Open source: https://github.com/MarcoAntolini/CSSHub
Privacy policy: https://marcoantolini.github.io/CSSHub/privacy-policy.html
```

---

## Version (store + repo)

First public Chrome Web Store release: **1.0.0** (unless you already uploaded 1.0.0 to the dashboard—in that case bump patch and rebuild).

| Location | Field | Current |
| --- | --- | --- |
| Store upload | Package version | Must match `manifest.json` |
| [`apps/extension/public/manifest.json`](../apps/extension/public/manifest.json) | `version` | `1.0.0` |
| [`apps/extension/package.json`](../apps/extension/package.json) | `version` | `1.0.0` |
| Root [`package.json`](../package.json) | `version` | `1.0.0` |

After a version bump: rebuild production, run `npm run package:extension:store`, and upload the new zip.

---

## Store package (zip)

Chrome Web Store expects **the contents of `dist/`** at the zip root (`manifest.json` next to `background.js`, not inside a `dist/` folder).

### Option A — CI artifact (recommended for release)

1. GitHub → **Actions** → **Extension Build** → **Run workflow**
2. **target:** `production` (requires repo variable `EXTENSION_PRODUCTION_BACKEND_URL`)
3. When the run finishes, download artifact **`extension-dist-production`**
4. Unzip into `apps/extension/dist/` (or any folder that contains `manifest.json` at its root)
5. From repo root:

```bash
npm run package:extension:store
# or: node scripts/package-extension-store.mjs /path/to/unzipped/dist
```

6. Upload `release/csshub-<version>.zip` in the Developer Dashboard

### Option B — Local production build

```bash
# apps/extension/.env.production.local must set VITE_OAUTH_BACKEND_BASE_URL (and other prod vars)
npm run build:extension:prod
npm run package:extension:store
```

Output: `release/csshub-1.0.0.zip` (gitignored under `/release`).

### Sanity check before upload

- [ ] `manifest.json` `version` matches the version you enter in the dashboard
- [ ] No `localhost` in `host_permissions` (production build)
- [ ] OAuth backend origin present in `host_permissions` (from `VITE_OAUTH_BACKEND_BASE_URL`)
- [ ] Smoke test: load unpacked from the same `dist/` you zipped, sign in, sync on a CSSBattle play URL
