# CssHub Privacy Policy

**Effective date:** 20 May 2026  
**Public URL (GitHub Pages):** https://marcoantolini.github.io/CSSHub/privacy-policy.html

CssHub is an open-source Chrome extension that syncs your [CSSBattle](https://cssbattle.dev) submissions to a GitHub repository you choose. This policy describes what data the extension handles and where it goes. It aligns with the technical inventory in [`privacy-data-map.md`](./privacy-data-map.md).

## Summary

- **Single purpose:** Help you back up CSSBattle solutions to **your** GitHub repo.
- **GitHub access token:** Stored in **session-only** extension storage; cleared on logout or browser session reset.
- **Other settings and submission data:** Stored **locally on your device** until you change or clear them.
- **GitHub API:** Used only to authenticate you and read/write the repository you select.
- **OAuth backend:** Used only during **web** sign-in to exchange a short-lived authorization code for a token (client secret stays on the server).
- **CSSBattle:** The extension reads submission data from CSSBattle play pages you open; it does not run on other sites.
- **No CssHub analytics:** CssHub does not operate product analytics, advertising trackers, or a CssHub-hosted user profile database.

## Who operates CssHub

CssHub is maintained as an open-source project ([GitHub repository](https://github.com/MarcoAntolini/CSSHub)). The extension is distributed via the Chrome Web Store. CssHub is **not** affiliated with CSSBattle or GitHub.

## Data the extension collects and stores

All storage is in **Chrome extension storage on your device** unless noted below.

| Data | Where stored | Why | Retention |
| --- | --- | --- | --- |
| GitHub access token | `chrome.storage.session` | Authenticate GitHub API requests for sync | Until logout or session ends |
| Auth status (signed-in flag, GitHub username, sign-in method) | `chrome.storage.local` | Show status in popup and settings | Until logout or reset |
| Settings (repo, branch, score threshold, notifications, README mode) | `chrome.storage.local` | Remember your choices | Until you change or reset |
| Last submission (challenge id, CSS, optional preview images) | `chrome.storage.local` | Show recent activity and support sync | Overwritten by newer submissions |
| Sync results and activity log events (up to 15) | `chrome.storage.local` | In-extension status and troubleshooting | Until you clear the log or reset |

CssHub does **not** persist your GitHub token in long-term (`local`) storage.

## Data sent to third parties

### GitHub (`api.github.com`, `github.com`)

When you sign in and sync, the extension sends your GitHub token (or OAuth/device/PAT credentials you provide) to GitHub to:

- Confirm your identity and username
- List repositories and branches you can access
- Create or update files and commits in the repository **you** selected

CssHub only accesses GitHub on your behalf for sync; it does not sell or share your data with other parties.

### CssHub OAuth backend (production: hosted on Vercel)

For **web** GitHub sign-in only, the extension sends a short-lived OAuth `code`, `state`, and `redirectUri` to the configured CssHub backend. The backend:

- Validates OAuth state and redirect URL
- Exchanges the code with GitHub using the **client secret** stored on the server
- Returns an access token to the extension

The backend is designed for OAuth exchange and rate limiting—not to store your submissions, CSS, or long-term account profiles. Operational logs should not include tokens or full OAuth payloads (see backend documentation).

### CSSBattle (`cssbattle.dev`, `www.cssbattle.dev`)

A content script runs only on CSSBattle **play** URLs. It reads submission-related data visible on the page (for example challenge id and CSS) so you can sync to GitHub. That data is processed in the extension and, when you sync, written to your chosen GitHub repo—not to a CssHub cloud database.

## What CssHub does not do

- **No CssHub analytics:** No first-party analytics SDK, event pipeline, or advertising network in the extension.
- **No CssHub account:** There is no separate CssHub login or cloud library of your battles.
- **No broad web browsing access:** Host access is limited to GitHub, CSSBattle, and the OAuth backend origin baked into your build (see extension manifest).

Optional **desktop notifications** (if enabled in settings) are generated locally by Chrome when a sync succeeds or fails; they are not sent to CssHub servers.

## Your choices

- **Sign out** removes the session token and resets authenticated state.
- **Clear activity log** removes stored sync events in settings.
- **Uninstall** removes extension-local data from your browser profile.

## Children

CssHub is not directed at children under 13, and we do not knowingly collect personal information from children.

## Changes

We may update this policy when data practices change. The effective date at the top will be revised; the canonical technical map remains in [`privacy-data-map.md`](./privacy-data-map.md).

## Contact

Questions or privacy requests: open an issue on the [CssHub GitHub repository](https://github.com/MarcoAntolini/CSSHub/issues).

## Publishing this policy (maintainers)

To serve the HTML version on GitHub Pages:

1. Repository **Settings → Pages**
2. **Build and deployment:** Deploy from branch `main` (or your default branch), folder **`/docs`**
3. Confirm the live URL: `https://<user>.github.io/<repo>/privacy-policy.html`

The browser-facing copy is [`privacy-policy.html`](./privacy-policy.html).
