<div align="center">

<img src="apps/extension/public/banner.png" alt="CssHub banner" width="800" />

<br />

**Save your [CSSBattle](https://cssbattle.dev) solutions to GitHub without copy-paste.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white&style=for-the-badge)](https://chromewebstore.google.com/detail/csshub/oakkijoinjkdhcgnpnmnpjkmpdekajid)
[![release](https://img.shields.io/badge/release-v1.1.0-blue?style=for-the-badge)](https://github.com/MarcoAntolini/CSSHub/releases)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

[Install CssHub](https://chromewebstore.google.com/detail/csshub/oakkijoinjkdhcgnpnmnpjkmpdekajid) · [Privacy Policy](https://marcoantolini.github.io/CSSHub/privacy-policy.html) · [Report an Issue](https://github.com/MarcoAntolini/CSSHub/issues/new?template=bug_report.yml)

</div>

---

## CssHub in One Minute

CssHub is a Chrome extension for CSSBattle players. It takes the solutions you already write on CSSBattle and syncs them to a GitHub repository you choose, so your battles become a searchable, shareable progress log.

You keep solving. CssHub keeps the repo updated.

## Why Install It?

- **No copy-paste routine** — send solutions to GitHub from the browser.
- **A clean battle archive** — keep Battles and Daily Targets in one repo.
- **Progress you can look back on** — commits show how your solutions changed over time.
- **Portfolio-friendly history** — your CSSBattle work is easier to browse, share, and preserve.
- **Your repo, your control** — choose the repository and branch CssHub writes to.

## Get Started

1. [Install CssHub from the Chrome Web Store](https://chromewebstore.google.com/detail/csshub/oakkijoinjkdhcgnpnmnpjkmpdekajid).
2. Pin CssHub in Chrome if you want quick access.
3. Open the extension settings, sign in with GitHub, and choose where to save your solutions.
4. Open a CSSBattle play page and solve as usual.

CssHub works in Google Chrome and Chromium browsers with Manifest V3 support.

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

## Privacy

CssHub is built for one job: syncing your CSSBattle solutions to your GitHub repo.

It does not run analytics, create a CssHub cloud account, or store your battle library on a CssHub server. For the full data handling details, read the hosted [CssHub Privacy Policy](https://marcoantolini.github.io/CSSHub/privacy-policy.html).

## For Developers

### Project Structure

```
.
├── apps/
│   ├── backend/          # OAuth service for GitHub sign-in
│   └── extension/        # Chrome extension source
├── docs/                 # Privacy page, maintainer docs, screenshots
├── packages/
│   └── shared/           # Shared contracts used by the app packages
├── scripts/              # Maintainer and release helpers
├── CHANGELOG.md
├── LICENSE
└── package.json
```

### More Documentation

Need implementation details? Start here:

| Resource | Description |
|----------|-------------|
| [`apps/extension/README.md`](apps/extension/README.md) | Build, run, package, and configure the Chrome extension |
| [`apps/backend/README.md`](apps/backend/README.md) | OAuth backend setup and deployment |
| [`docs/ops-runbook.md`](docs/ops-runbook.md) | Maintainer troubleshooting and rollback notes |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |

## Support

Install or update CssHub from the [Chrome Web Store](https://chromewebstore.google.com/detail/csshub/oakkijoinjkdhcgnpnmnpjkmpdekajid).

If something does not work, open a [bug report](https://github.com/MarcoAntolini/CSSHub/issues/new?template=bug_report.yml) with the CSSBattle URL, extension version, browser, and steps to reproduce. If you have an idea for the extension, open a [feature request](https://github.com/MarcoAntolini/CSSHub/issues/new?template=feature_request.yml).

## Contributing

Pull requests are welcome. For small fixes, open a PR directly. For larger changes, start with an issue so the scope is clear before implementation.

Useful places to start:

- Extension work: [`apps/extension/README.md`](apps/extension/README.md)
- OAuth/backend work: [`apps/backend/README.md`](apps/backend/README.md)
- Maintainer troubleshooting: [`docs/ops-runbook.md`](docs/ops-runbook.md)

GitHub applies the [pull request template](https://github.com/MarcoAntolini/CSSHub/blob/main/.github/pull_request_template.md) automatically.

If CssHub saves you time, star this repo. It helps other CSSBattle players find the extension.

<a href="https://github.com/MarcoAntolini/CSSHub/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=MarcoAntolini/CSSHub" alt="Contributors" />
</a>

## License

MIT — see [LICENSE](LICENSE).
