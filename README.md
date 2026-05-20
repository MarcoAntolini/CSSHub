<div align="center">

<img src="apps/extension/public/banner.png" alt="CssHub banner" width="800" />

<br />

**Automatically sync your [CSSBattle](https://cssbattle.dev) submissions to GitHub.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp)
[![release](https://img.shields.io/badge/release-v1.0.1-blue)](https://github.com/MarcoAntolini/CSSHub/releases)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

---

## What is CssHub?

CssHub is a **Chrome extension** that pushes your CSSBattle solutions into a **GitHub repository** you choose—so every pass becomes a commit you can browse, diff, and share like normal code.

No copy-paste, no drag-and-drop zip files: you play on CSSBattle, CssHub keeps your repo up to date.

## Why CssHub?

- **One place for your battles** — Challenges and submissions live in a repo structure you control.
- **Git history as your progress log** — See how your solutions evolved over time.
- **Backup & portfolio** — Your work stays on GitHub even if you clear browser data (once synced).
- **Built for CSSBattle** — Works on the official play experience you already use.

## Screenshots

<p align="center">
  <img src="docs/screenshots/popup.png" alt="CssHub popup on CSSBattle with a committed submission" width="720" />
</p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="CssHub settings: GitHub account and repository" width="720" />
  <img src="docs/screenshots/activity-log.png" alt="CssHub activity log with sync outcomes" width="720" />
</p>

<p align="center">
  <img src="docs/screenshots/github.png" alt="GitHub commit created by CssHub" width="720" />
</p>

## Supported platform

- **[CSSBattle](https://cssbattle.dev)** — `cssbattle.dev` and `www.cssbattle.dev` (play URLs).

Use **Google Chrome** (or another Chromium browser with Manifest V3 support).

## Installation

### 1. Chrome Web Store (recommended)

**[Install CssHub from the Chrome Web Store](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp)** — updates install automatically.

### 2. Manual install (developers)

If you build from source, load the unpacked extension from `apps/extension/dist` after a build. Full setup (env files, local OAuth backend, scripts) is in **[`apps/extension/README.md`](apps/extension/README.md)**.

## After you install

1. Pin **CssHub** from the puzzle menu if you like quick access.
2. Open **CssHub** → **Settings** (or the extension options page).
3. **Sign in with GitHub** (pick the method you prefer in settings).
4. Choose the **repository** (and branch, if you use something other than the default).
5. Open a **CSSBattle** play page and solve as usual—CssHub syncs your submission to GitHub when you use the extension flow on that challenge.

If something fails, check the in-extension activity log in settings for a short, human-readable message.

## Privacy in plain English

- CssHub needs **GitHub access** only to write to **your** chosen repo (and related metadata like branches).
- Your **GitHub token is kept in session-only extension storage** on your device (cleared on sign-out); settings and an activity log (up to **15** events) stay in local extension storage—not on a CssHub account in the cloud.
- CssHub only runs on **CSSBattle** play pages, plus **GitHub** and the **OAuth backend** for sign-in and sync.
- **No CssHub analytics** — no first-party tracking or advertising SDK.
- **Privacy policy:** https://marcoantolini.github.io/CSSHub/privacy-policy.html (source in [`docs/privacy-policy.md`](docs/privacy-policy.md).
- Technical inventory: [`docs/privacy-data-map.md`](docs/privacy-data-map.md). Extension and backend details: [`apps/extension/README.md`](apps/extension/README.md), [`apps/backend/README.md`](apps/backend/README.md).
- Chrome Web Store listing draft (maintainer, local): `docs/internal/chrome-web-store-listing.md` (gitignored).

## Support

Using CssHub? Install or update from the [Chrome Web Store](https://chromewebstore.google.com/detail/csshub/jafemcjfpjjdbcfjjfohjfglckbkjbbp). If something breaks or you want a feature, open a [GitHub issue](https://github.com/MarcoAntolini/CSSHub/issues)—the [bug report](https://github.com/MarcoAntolini/CSSHub/issues/new?template=bug_report.yml) and [feature request](https://github.com/MarcoAntolini/CSSHub/issues/new?template=feature_request.yml) templates include the fields we need (CSSBattle URL, extension version, steps to reproduce).

## Contributing

Pull requests are welcome. GitHub applies the [PR template](https://github.com/MarcoAntolini/CSSHub/blob/main/.github/pull_request_template.md) automatically; for larger changes, start with an issue so we can align on scope. Maintainer ops (OAuth, rollback): [`docs/ops-runbook.md`](docs/ops-runbook.md).

If CssHub saves you time, **star** this repo—it helps other CSSBattle players find it.
