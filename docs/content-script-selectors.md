# Content script selector inventory

CssHub’s content script scrapes CSSBattle’s play page DOM. Selectors are brittle when the site changes; this document is the canonical inventory. Pure parsing lives in `contentScriptDom.ts` and `contentScriptStats.ts` with fixture tests under `apps/extension/tests/`.

## Stats and leaderboard (`contentScriptStats.ts`)

| Constant | Pattern / selector | Purpose | Module |
|----------|-------------------|---------|--------|
| `LAST_SCORE_LABEL` | `/last\s*score/i` | Detect “Last score” label in text blobs | `contentScriptStats.ts` |
| `LAST_SCORE_LABEL_GLOBAL` | `/last\s*score/gi` | Global variant for `parseScoreFromText` | `contentScriptStats.ts` |
| `MATCH_REGEX` | `/(\d+(?:[.,]\d+)?)\s*%\s*(?:match)?/gi` | Parse match % before label | `contentScriptStats.ts` |
| `NUMBER_REGEX` | `/\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi` | Parse numeric score | `contentScriptStats.ts` |
| `LEADERBOARD_STATS_BOX_SELECTOR` | `.leaderboard-stats-box` | Preferred stats container | `contentScriptStats.ts` |
| (implicit) | `body *` with text `^last\s*score$` | Find label elements | `getLastScoreLabelElements` |
| (implicit) | `section, div, article, main` | Fallback roots containing “Last score” | `extractStatsFromDocument` |

**Tests:** `apps/extension/tests/unit/contentScriptStats.test.ts` + `tests/fixtures/cssbattle-play-minimal.html`

## Challenge metadata (`contentScriptDom.ts`)

| Constant | Pattern | Purpose |
|----------|---------|---------|
| `CHALLENGE_ID_PATH_REGEX` | `^/play/(\d+)` on `location.pathname` | Challenge id for payload |
| `CHALLENGE_TITLE_REGEX` | `Target\s*#?\d+\s*:\s*(.+)$` on `document.title` | Human-readable challenge name |

**Helpers:** `getChallengeIdFromPathname`, `getChallengeNameFromTitle`

## Submit detection (`contentScriptDom.ts` + `contentScript.ts`)

| Constant | Pattern / selector | Purpose |
|----------|-------------------|---------|
| `SUBMIT_LABEL` | `/submit/i` | Match submit control label/value |
| `CLICKABLE_SELECTOR` | `button, [role='button'], input[type='submit'], a` | Resolve click target via `closest()` |

Listener: capture phase on `document` (`contentScript.ts`), only on paths starting with `/play/`.

## Preview capture (`contentScriptDom.ts`)

| Constant | Selector | Purpose |
|----------|----------|---------|
| `PREVIEW_SELECTOR` | `iframe[title*='Preview' i]` | Crop screenshot via background `captureElement` |

## Editor code fallback (`contentScriptDom.ts`)

| Constant | Selector | Purpose |
|----------|----------|---------|
| `CM_LINE_SELECTOR` | `.cm-line` | Visible CodeMirror lines when Monaco hook unavailable |

Primary path: background `extractCssbattleEditorCode` (Monaco). DOM lines are fallback.

## Target reference image (`contentScriptDom.ts`)

| Heuristic | Condition | Purpose |
|-----------|-----------|---------|
| `isTargetImageElement` | `alt` contains `target` or `battle` | Pick challenge target `<img>` |
| | `class` contains `target` | |
| | `src` starts with `/targets/` | |
| (fallback) | first `canvas` | `toDataURL('image/png')` when no matching img |

**Helper:** `findTargetImage`

## Fixture and CI

- **Fixture:** `apps/extension/tests/fixtures/cssbattle-play-minimal.html` — minimal play-page fragments (stats box, submit, preview iframe, target img, CodeMirror lines).
- **Unit tests:** `contentScriptStats.test.ts`, `contentScript.dom.test.ts` (jsdom; no live cssbattle.dev).
- **Run:** `npm run test` from repo root.

When CSSBattle markup changes, update constants here, adjust the fixture, and extend tests before shipping.
