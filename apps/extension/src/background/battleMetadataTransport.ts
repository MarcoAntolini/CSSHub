import {
	BATTLE_METADATA_POLL_INTERVAL_MS,
	BATTLE_METADATA_POLL_TIMEOUT_MS,
	BATTLE_METADATA_STABLE_TICKS,
	BATTLE_PAGE_LOAD_TIMEOUT_MS,
	normalizeHydratedBattlePageMetadata,
	pollHydratedBattlePageMetadata,
	type HydratedBattlePageMetadata,
} from "@/battleMetadataHydration";
import { readOffscreenBattleMetadata } from "./offscreenBattleMetadata";

export type BattleMetadataHtmlFallbackDeps = {
	readViaOffscreen: (url: string) => Promise<HydratedBattlePageMetadata>;
	readViaInactiveTab: (url: string) => Promise<HydratedBattlePageMetadata>;
	fetchHtml: (url: string) => Promise<string>;
	onHydratedReadFailure: (source: "offscreen" | "inactive-tab", error: unknown) => void;
};

const hasKnownChallengeCount = (metadata: HydratedBattlePageMetadata): boolean =>
	metadata.totalChallenges !== null;

export const toHydratedBattleMetadataHtml = (
	metadata: HydratedBattlePageMetadata
): string => [
	"<section class=\"targets-container\">",
	...Array.from({ length: metadata.totalChallenges ?? 0 }, (_, index) =>
		`<a href="/play/${index + 1}" class="target-tile"></a>`
	),
	"</section>",
	metadata.status ? `<span class="battle-status-pill">${metadata.status}</span>` : "",
].join("");

export const readBattleMetadataHtmlWithFallbacks = async (
	url: string,
	deps: BattleMetadataHtmlFallbackDeps
): Promise<string> => {
	try {
		const metadata = await deps.readViaOffscreen(url);
		if (hasKnownChallengeCount(metadata)) {
			return toHydratedBattleMetadataHtml(metadata);
		}
	} catch (error) {
		deps.onHydratedReadFailure("offscreen", error);
	}

	try {
		const metadata = await deps.readViaInactiveTab(url);
		if (hasKnownChallengeCount(metadata)) {
			return toHydratedBattleMetadataHtml(metadata);
		}
	} catch (error) {
		deps.onHydratedReadFailure("inactive-tab", error);
	}

	return deps.fetchHtml(url);
};

const waitForTabComplete = (tabId: number, timeoutMs: number): Promise<void> =>
	new Promise((resolve, reject) => {
		const timeout = globalThis.setTimeout(() => {
			chrome.tabs.onUpdated.removeListener(listener);
			reject(new Error("CSSBattle battle page timed out before loading"));
		}, timeoutMs);

		const listener = (updatedTabId: number, info: { status?: string }): void => {
			if (updatedTabId !== tabId || info.status !== "complete") {
				return;
			}
			globalThis.clearTimeout(timeout);
			chrome.tabs.onUpdated.removeListener(listener);
			resolve();
		};

		chrome.tabs.onUpdated.addListener(listener);
		void chrome.tabs
			.get(tabId)
			.then((tab) => {
				if (tab.status === "complete") {
					globalThis.clearTimeout(timeout);
					chrome.tabs.onUpdated.removeListener(listener);
					resolve();
				}
			})
			.catch(() => {
				/* onUpdated or the timeout will handle failures. */
			});
	});

export const readInactiveTabBattleMetadata = async (
	url: string
): Promise<HydratedBattlePageMetadata> => {
	const tab = await chrome.tabs.create({ url, active: false });
	if (typeof tab.id !== "number") {
		throw new Error("CSSBattle battle page tab could not be created");
	}

	try {
		await waitForTabComplete(tab.id, BATTLE_PAGE_LOAD_TIMEOUT_MS);
		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: pollHydratedBattlePageMetadata,
			args: [
				BATTLE_METADATA_POLL_TIMEOUT_MS,
				BATTLE_METADATA_POLL_INTERVAL_MS,
				BATTLE_METADATA_STABLE_TICKS,
			],
		});
		const metadata = normalizeHydratedBattlePageMetadata(results[0]?.result);
		if (!metadata) {
			throw new Error("CSSBattle battle page metadata could not be read");
		}
		return metadata;
	} finally {
		await chrome.tabs.remove(tab.id).catch(() => {
			/* Tab may already be gone. */
		});
	}
};

export const fetchStaticBattleMetadataHtml = async (url: string): Promise<string> => {
	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) {
		throw new Error(`CSSBattle battle metadata request failed (${response.status})`);
	}

	return response.text();
};

export const readBattleMetadataHtml = (url: string): Promise<string> =>
	readBattleMetadataHtmlWithFallbacks(url, {
		readViaOffscreen: readOffscreenBattleMetadata,
		readViaInactiveTab: readInactiveTabBattleMetadata,
		fetchHtml: fetchStaticBattleMetadataHtml,
		onHydratedReadFailure: (source, error) => {
			console.warn(`CssHub: ${source} CSSBattle battle page read failed`, error);
		},
	});
