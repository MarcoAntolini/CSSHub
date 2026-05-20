# CssHub Release Readiness Checklist

Use this checklist before publishing to Chrome Web Store.

## Current Snapshot (2026-05-15)

- [x] `typecheck`, `test`, `test:e2e`, `test:security`, `lint` pass locally
- [x] Security JSON report generation works (`test:security:json`)
- [x] Privacy data map drafted in `docs/privacy-data-map.md`
- [x] Architecture review drafted in `docs/architecture-review.md`
- [ ] Strict security gate (`test:security:strict`) still failing on transitive dependency vulnerabilities
- [ ] GitHub Actions `Quality Gates` run still to be validated on remote CI

## Quality Gates

- [x] `npm run typecheck` passes
- [x] `npm run test` passes
- [x] `npm run test:e2e` passes
- [x] `npm run lint` passes (0 errors)
- [x] `npm run test:security` passes (default gate: secrets + critical dependencies)
- [ ] `npm run test:security:strict` reviewed (strict gate: secrets + high/moderate/critical dependencies)
- [x] `npm run build:extension:prod` passes with `VITE_OAUTH_BACKEND_BASE_URL` set (full `npm run build` includes backend workspace)
- [ ] GitHub Actions `Quality Gates` workflow passes and uploads `security-report` artifact

## Performance

See [`performance.md`](./performance.md) for SLOs and manual matrix. Automated gates verified 2026-05-15.

- [x] `npm run build:extension:prod` + `npm run check:bundle-budgets` pass (set `VITE_OAUTH_BACKEND_BASE_URL`; see [`bundle-baseline.md`](./bundle-baseline.md))
- [x] Unit perf tests pass (`syncSubmission`, `contentScriptStats`, `contentScript.dom` — part of `npm run test`)
- [x] E2E `submission-perf.spec.ts` passes (mocked GitHub, &lt; 8 s SLO; included in `npm run test:e2e`)
- [ ] Manual Chrome Web Store perf matrix completed on production `dist/` (see [`performance.md`](./performance.md) § Manual matrix)
- [ ] `docs/performance-signoff-YYYY-MM-DD.md` recorded (optional audit trail)

## Security

- [x] No hardcoded secrets in source, docs, env examples, or artifacts
- [ ] OAuth backend uses redirect whitelist and state validation
- [ ] Backend logs avoid tokens and PII payloads
- [x] Auth/logout lifecycle clears session token state
- [x] Manifest permissions reviewed for least privilege in `apps/extension/public/manifest.json`

## Privacy and Data Handling

- [x] Data map reviewed: token, GitHub username, selected repo/branch, submission payload, images/data URLs, activity events
- [ ] Retention behavior verified (local storage/session storage only as intended)
- [x] Clear log and logout behavior validated
- [x] README privacy sections match actual data flow (see root README + [`privacy-policy.md`](./privacy-policy.md))
- [x] Chrome Store data disclosure draft aligns with implementation ([`chrome-web-store-listing.md`](./chrome-web-store-listing.md) § Data safety)
- [x] Privacy policy drafted ([`privacy-policy.md`](./privacy-policy.md), [`privacy-policy.html`](./privacy-policy.html))
- [ ] Privacy policy URL live on GitHub Pages (Settings → Pages → `/docs`)

## Store Package Readiness

- [ ] Extension build artifact is clean (no debug leftovers)
- [x] Listing copy drafted (features, permission rationale, privacy note — [`chrome-web-store-listing.md`](./chrome-web-store-listing.md))
- [ ] Screenshots and promotional assets updated
- [ ] Final smoke test run performed on unpacked extension
- [ ] Release candidate tagged and archived
