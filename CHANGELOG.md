# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-05-20

First public release: Chrome extension that syncs [CSSBattle](https://cssbattle.dev) submissions to a user-selected GitHub repository, with a Vercel OAuth backend for secure web sign-in.

### Added

- Chrome extension (Manifest V3): sync on CSSBattle play pages, popup, and settings UI
- GitHub sign-in via web OAuth, device flow, or personal access token
- Repository and branch selection; optional root README index (`off` / `managed` / `full`)
- Score threshold, duplicate and not-improved skip logic, and in-extension activity log (15 events)
- Optional desktop notifications and submission preview images on commits
- OAuth backend on Vercel: code exchange, state validation, rate limiting, health check
- `@csshub/shared` package with Zod contracts and OAuth wire schemas
- Monorepo scripts: `dev`, production/staging extension builds, `doctor:oauth`, bundle budgets
- CI: Quality Gates (typecheck, lint, test, e2e, security report) and Extension Build artifacts
- Tests: Vitest unit tests, Playwright e2e smoke and submission perf specs
- Documentation: privacy policy, privacy data map, Chrome Web Store listing copy, release readiness checklist
- GitHub issue templates (bug report, feature request), pull request template, and store zip script (`npm run package:extension:store`)
- README screenshots and Chrome Web Store listing assets in `docs/screenshots/`

### Changed

- Modular extension architecture (`background/`, `settings/`, shared sync extraction)
- Chrome Web Store listing: copy-paste short and detailed descriptions, data safety form walkthrough, and package instructions

### Fixed

- Vercel production deploy: ESM imports, API-only output, and vendored `@csshub/shared` for serverless bundles
- Content script: full CodeMirror document capture on submit; inline tab message validation
- Managed README sync preserves existing challenge link labels instead of re-deriving slugs
- Desktop notification clicks open the GitHub commit or CssHub settings; clearer notifications copy in settings

### Security

- GitHub client secret stays on the OAuth backend; extension uses session-only token storage
- Security checks in CI for secret patterns and dependency severity (default gate)
