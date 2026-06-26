# ADR 0003: Hydrated battle page for Battle Metadata

## Status

Accepted

## Context

Battle Metadata (Target total and finished/unfinished status) drives Battle Archive README progress in the Selected Repository. CSSBattle battle overview pages (`/battle/{id}`) are client-rendered: a plain `fetch()` often returns a loading shell without Target tiles or status pills.

CssHub needs reliable totals when enriching battle-mode Submissions and when refreshing cached metadata in the background.

## Decision

When the background worker needs battle overview HTML, it **prefers a hydrated DOM read** over static fetch:

1. Open the battle URL in a short-lived background tab.
2. Wait for tab `complete`, then inject a polling script that reads Target links/tiles and status text until the count is stable for three consecutive ticks (250 ms interval, 12 s timeout).
3. If hydration yields a Target count, synthesize minimal HTML from that count and status for the existing parser in `cssbattleBattleMetadata.ts`.
4. If hydration fails or times out, fall back to `fetch(url, { credentials: "include" })` and parse whatever HTML is returned.

On the play page, content script resolution tries remote metadata first (`fetchCssbattleBattleMetadata`), then falls back to local DOM extraction from the play-page dropdown or Target list when remote totals are missing.

Finished battles with a known Target total are cached in extension storage and are not re-fetched unless the cache entry is incomplete.

## Rejected alternatives

**Static fetch only.** Frequently parsed empty or partial battle pages, producing wrong or missing Battle Metadata in commits and README updates.

**Require the user to visit the battle overview manually.** Adds friction and leaves README progress stale when users only play from Target links.

**Scrape battle totals exclusively from the play-page dropdown.** Works as a fallback but can under-count when the dropdown is collapsed or not yet populated; remote hydration is more authoritative.

## Consequences

- Background metadata reads may briefly open a hidden tab; failures are logged and degrade to fetch fallback.
- Selector brittleness is documented in `docs/content-script-selectors.md`; this ADR records the sourcing strategy, not individual selectors.
- Cache semantics favor stability: a finished battle with totals is treated as immutable until explicitly invalidated by incomplete cache entries.
- Tests cover handler polling, parser output, and content-script source merging.
- Related: ADR 0004 (Battle Metadata used during commit README updates).
