# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-06-23

### Added

- Battle submissions capture optional CSSBattle battle totals and finished/unfinished status for generated README progress
- Managed root README battle groups display synced progress as `x/y` for finished battles and `x/y+` for unfinished battles
- Battle archives now write `battle.json` manifests so Battle progress uses one durable Battle-level metadata source
- Managed root README daily target months display saved-over-available progress counts
- Popup shows a processing spinner on the last submission card while capture and sync is in progress
- Settings **How sync works** section explains background sync and the brief inactive CSSBattle tab used for battle README progress

### Changed

- Privacy policy and data map document background service fetches and short-lived inactive CSSBattle tabs during sync
- `CONTEXT.md` domain glossary defines shared product language for targets, submissions, and sync outcomes

### Fixed

- Finished Battles no longer keep a stale `+` in the managed README because an older Target `submission.json` said the Battle was unfinished
- Battle Metadata fetch now waits for the hidden Battle overview page to hydrate before reading Target totals and finished status
- Submission character counts are normalized to numbers before sync when CSSBattle omits the field

## [1.2.0] - 2026-06-17

### Added

- Extension icon shows setup-required badges while GitHub auth or repository selection is missing
- CSSBattle submission character counts are captured and included in commit messages, `submission.json`, and managed README index entries

### Fixed

- Sync status badges are suppressed until setup is complete and clear back to the correct extension icon state
- CSSBattle Cmd+Enter/Ctrl+Enter submissions trigger extension sync through the same ingestion path as submit clicks
- README battle index sorts challenges by number within each battle group (e.g. #10 after #9, not before #2)

## [1.1.0] - 2026-06-10

Battles and Daily Targets sync, target-image previews, and a large extension/backend refactor since v1.0.1.

### Added

- Battles and Daily Targets sync with managed README index
- CSSBattle target image capture (DOM scrape and service-worker fetch) for commit previews
- Shared preview capture injection into child frames; preview capture and remote image messaging schemas in `@csshub/shared`
- Sync event codes and expanded extension contracts in `@csshub/shared`
- Challenge model, ingest pipeline, and modular GitHub client (`commit`, `contents`, `repos`, `transport`)
- Popup split into focused modules (`App`, `SubmissionFlowSection`, `usePopupState`, status demo cases)
- Backend shared OAuth POST route middleware (`oauthPostHandler`)
- Fallow config (`.fallowrc.json`) and PR audit CI gate
- `AGENTS.md` with Cursor Cloud development instructions
- E2E fixtures for CSSBattle play page variants (battle, daily, multi-target)

### Changed

- Monorepo refactor: modularize extension (`background/handlers`, `storage/`, `submission/`, `settings/`) and centralize shared contracts
- Content script rewrite with challenge context, DOM helpers, messaging, and expanded stats scraping
- README overhauls (root and package READMEs), updated screenshots, and ops runbook updates
- Settings repository section layout; activity log polish with GitHub-linked labels
- Chrome Web Store packaging script strips `manifest.key` from dist before zipping

### Fixed

- OAuth state handling on Vercel
- CSSBattle submission sync stability (resubmits when last score is already visible)
- GitHub sync hardened against fast-forward conflicts
- Chrome Web Store production builds omit `manifest.key` from the packaged manifest

## [1.0.1] - 2026-05-20

Documentation and maintainer ops polish after the v1.0.0 prepare commit.

### Added

- Maintainer ops runbook ([`docs/ops-runbook.md`](docs/ops-runbook.md)): OAuth login troubleshooting, Redis/rate limits, rollback

### Changed

- Pre-release maintainer docs moved to gitignored `docs/internal/` (store listing draft, release checklist, architecture review, bundle baseline, perf matrix)
- README: Support and Contributing sections; privacy copy notes 15-event activity log cap
- Privacy data map: retention table with code references; activity log sanitization via `toUserSafeError`
- Extension README: `chrome.storage.session` vs `local` clarified; links to internal store listing path

### Removed

- Tracked copies of maintainer-only docs from `docs/` (kept locally under `docs/internal/`)

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
