# Content script selector inventory

CssHub’s content script scrapes CSSBattle’s play page DOM. Selectors are brittle when the site changes; this document is the canonical inventory. Pure parsing lives in `contentScriptDom.ts` and `contentScriptStats.ts` with fixture tests under `apps/extension/tests/`.

## Submission surface invariant

Users submit Solutions from CSSBattle Target play pages (`https://cssbattle.dev/play/{targetId}`), not from Battle overview pages (`https://cssbattle.dev/battle/{battleId}`). The content script should treat the current page as the Target submission surface. Battle overview pages are only a background metadata source for Battle-level Target totals and finished/unfinished status.

Battle Metadata must come from a hydrated Battle overview DOM. Static `fetch()` HTML can be only a fallback because CSSBattle may serve a loading shell before client-rendered Target tiles and status text are available.

## Stats and leaderboard (`contentScriptStats.ts`)

| Constant | Pattern / selector | Purpose | Module |
|----------|-------------------|---------|--------|
| `LAST_SCORE_LABEL` | `/last\s*score/i` | Detect “Last score” label in text blobs | `contentScriptStats.ts` |
| `LAST_SCORE_LABEL_GLOBAL` | `/last\s*score/gi` | Global variant for `parseScoreFromText` | `contentScriptStats.ts` |
| `MATCH_REGEX` | `/(\d+(?:[.,]\d+)?)\s*%\s*(?:match)?/gi` | Parse match % in legacy score text before the label | `contentScriptStats.ts` |
| `EXPLICIT_MATCH_REGEX` | `/(\d+(?:[.,]\d+)?)\s*%\s*match/gi` | Parse explicit result text such as “100% match” without confusing threshold percentages for match results | `contentScriptStats.ts` |
| `NUMBER_REGEX` | `/\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi` | Parse numeric score | `contentScriptStats.ts` |
| `LEADERBOARD_STATS_BOX_SELECTOR` | `.leaderboard-stats-box` | Preferred stats container | `contentScriptStats.ts` |
| (implicit) | `body *` with text `^last\s*score$` | Find label elements | `getLastScoreLabelElements` |
| (implicit) | `section, div, article, main` | Fallback roots containing “Last score” | `extractStatsFromDocument` |

| `parseScoreFromText` | Text around the final “Last score” label | Supports legacy “score match Last score” and current “Last score score” ordering |
| `waitForPostSubmitStats` | Poll + `MutationObserver` on `.leaderboard-stats-box` | Detect post-submit updates; null stats on timeout without DOM activity |

**Tests:** `apps/extension/tests/unit/contentScriptStats.test.ts` + `tests/fixtures/cssbattle-play-minimal.html`

## Challenge metadata (`contentScriptDom.ts`)

| Constant | Pattern | Purpose |
|----------|---------|---------|
| `CHALLENGE_ID_PATH_REGEX` | `^/play/([^/]+)` on `location.pathname` | Challenge id for payload (numeric or opaque daily id) |
| `CHALLENGE_TITLE_REGEX` | `Target\s*#?\d+\s*:\s*(.+)$` on `document.title` | Human-readable challenge name (battles) |

**Helpers:** `getChallengeIdFromPathname`, `getChallengeNameFromTitle`

## Challenge mode (`contentScriptChallengeContext.ts`)

| Constant | Selector / rule | Purpose |
|----------|-----------------|---------|
| `BREADCRUMB_CONTAINER_SELECTOR` | `[class*="breadcrumbs"]` | Header breadcrumb container |
| (implicit) | `a, button` inside container | Battle crumbs (links + current target button) |
| (fallback) | `innerText` split by newline | Daily date crumb when only one link is present |
| Classification | First crumb `Battles` + ≥3 crumbs | `battle` mode → sync |
| Classification | First crumb `Daily Targets` + date crumb | `daily` mode → sync |
| Classification | Anything else | `unsupported` → skip sync (no background message) |

**Helpers:** `collectBreadcrumbTexts`, `classifyChallengeContext`, `detectChallengeContext`, `parseDailyDateLabelToIso`

**Fixtures:** `cssbattle-play-battle.html`, `cssbattle-play-daily.html` — **Tests:** `contentScriptChallengeContext.test.ts`

## Submit detection (`contentScriptDom.ts` + `contentScript.ts`)

| Constant | Pattern / selector | Purpose |
|----------|-------------------|---------|
| `SUBMIT_LABEL` | `/submit/i` | Match submit control label/value |
| `CLICKABLE_SELECTOR` | `button, [role='button'], input[type='submit'], a` | Resolve click target via `closest()` |

Listener: capture phase on `document` (`contentScript.ts`), only on paths starting with `/play/`.

## Preview capture (`contentScriptDom.ts`)

| Constant / helper | Selector / behavior | Purpose |
|-------------------|---------------------|---------|
| `PREVIEW_IFRAME_SELECTORS` | `.preview-iframe`, `[class*='preview-iframe']`, `title="Preview"`, then `PREVIEW_SELECTOR` | Resolve preview iframe (CSSBattle markup changes) |
| `findPreviewIframe` | Falls back to largest visible `allow-same-origin` iframe | Last-resort preview detection |
| `capturePreviewFromIframeDocument` | Reads `canvas` / `img` / `svg` inside same-origin iframe | Preferred capture (no tab screenshot race) |
| `waitForPreviewIframeReady` | Polls until preview iframe has painted content | Daily / slow post-submit renders |
| `capturePreview` (background) | Child-frame injection once, then one `captureTab` crop | Avoids `captureVisibleTab` rate limits / `activeTab` expiry |

## Editor code fallback (`contentScriptDom.ts`)

| Constant | Selector | Purpose |
|----------|----------|---------|
| `CM_LINE_SELECTOR` | `.cm-line` | Visible CodeMirror lines |
| `MONACO_LINE_SELECTOR` | `.monaco-editor .view-line` | Monaco editor DOM fallback |

Primary path: background `extractCssbattleEditorCode` (CodeMirror 6 `cmTile` hook). DOM lines are fallback (CodeMirror, then Monaco).

## Target reference image (`contentScriptDom.ts`)

| Heuristic | Condition | Purpose |
|-----------|-----------|---------|
| `scoreTargetImageCandidate` | Asset id matches `/play/{id}` from URL (+1000) | Beats sidebar thumbnails for other targets |
| | `src` / `currentSrc` matches `/targets/….(png\|jpg\|…)` | Strong signal (+100) |
| | `img.levelpage__target` queried first | Main challenge pane |
| | Numeric id fallback | `https://cssbattle.dev/targets/{id}.png` when DOM is stale |
| | Daily / opaque id | `meta[property="og:image"]` or ImageKit `og/target?id={id}` |
| | Generic `/targets/daily.png` | Excluded for opaque daily ids (site-wide placeholder) |
| | Footer exclusion | `.footer__deco` thumbs are never the challenge target |
| `waitForTargetImage` | Poll until DOM/meta sources are available | Client-rendered daily pages |
| | `class` includes `levelpage__target` or `__target` | BEM-style target pane |
| | `alt` contains `target` or `battle` | Legacy markup |
| | width ≥ 200px | Prefer full-size challenge target |
| `findTargetImage` | Highest-scoring `<img>` (not first in DOM) | Avoid decoy avatars/icons |
| `fetchTargetImagePayload` | Inlines target via background `fetchRemoteImage` | Bypasses CORS for Firebase/ImageKit URLs |
| `fetchRemoteImage` (background) | `host_permissions` fetch → data URL | `firebasestorage.googleapis.com`, `ik.imagekit.io` |
| (fallback) | `canvas` with target/levelpage class only | Avoid unrelated editor canvases |

**Helpers:** `findTargetImage`, `fetchTargetImagePayload`, `resolveCssBattleImageUrl` (background fetch fallback)

## Fixture and CI

- **Fixtures:** `cssbattle-play-minimal.html`, `cssbattle-play-current.html` (levelpage target + preview-iframe markup).
- **Unit tests:** `contentScriptStats.test.ts`, `contentScript.dom.test.ts` (jsdom; no live cssbattle.dev).
- **Run:** `npm run test` from repo root.

When CSSBattle markup changes, update constants here, adjust the fixture, and extend tests before shipping.
