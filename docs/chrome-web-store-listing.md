# Chrome Web Store listing copy

Draft text for CssHub v0.1 submission. Paste into the Developer Dashboard fields. Aligns with [`privacy-data-map.md`](./privacy-data-map.md) and [`privacy-policy.md`](./privacy-policy.md).

**Privacy policy URL:** https://marcoantolini.github.io/CSSHub/privacy-policy.html  
(Enable GitHub Pages from `/docs` — see privacy policy § Publishing.)

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

Use answers consistent with the privacy policy. Adjust if your build or backend URL differs.

| Question area | Suggested declaration |
| --- | --- |
| **Does your product collect user data?** | Yes — data required for core functionality |
| **Data types** | Account info (GitHub username after sign-in); user activity (submission metadata, CSS, optional images for sync); app activity (sync log events, settings) |
| **Purpose** | App functionality (sync to user’s GitHub repo; authentication) |
| **Shared with third parties** | Yes — GitHub (sync and auth); OAuth backend (web sign-in exchange only) |
| **Sold to third parties** | No |
| **Used for tracking** | No (no CssHub analytics) |
| **Encryption in transit** | Yes (HTTPS to GitHub, CSSBattle, OAuth backend) |
| **Users can request deletion** | Yes — sign out, clear log, uninstall extension (all local); GitHub data is in the user’s own repo |
| **Certified compliance** | Follow your jurisdiction; extension alone does not imply COPPA/GDPR certification |

**Storage disclosure:** Data is stored **on the user’s device** in Chrome extension storage (local + session). The GitHub token is **session-only**. Submission payloads and settings are local until logout, clear log, or uninstall.

**Privacy policy URL:** https://marcoantolini.github.io/CSSHub/privacy-policy.html

---

## Short description (store, ≤ 132 chars)

Sync your CSSBattle submissions to your GitHub repo automatically—version history, backup, and portfolio in one flow.

---

## Detailed description (store)

CssHub connects CSSBattle to GitHub:

- Play challenges on cssbattle.dev as usual
- Sign in with GitHub (web OAuth, device flow, or PAT)
- Pick a repository and branch
- Sync submissions as commits with optional preview images

Your GitHub token stays in session storage on your device. Settings and a short activity log stay in local extension storage. CssHub does not run analytics or store your battles on CssHub servers.

Open source: https://github.com/MarcoAntolini/CSSHub

Privacy policy: https://marcoantolini.github.io/CSSHub/privacy-policy.html
