import { getCssbattleBattleMetadata } from "@/cssbattleBattleMetadata";
import { getStoredState, saveStoredState } from "@/storage";
import type { Handler } from "./types";

const BATTLE_PAGE_LOAD_TIMEOUT_MS = 15_000;

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

const readHydratedBattlePageHtml = async (url: string): Promise<string> => {
	const tab = await chrome.tabs.create({ url, active: false });
	if (typeof tab.id !== "number") {
		throw new Error("CSSBattle battle page tab could not be created");
	}

	try {
		await waitForTabComplete(tab.id, BATTLE_PAGE_LOAD_TIMEOUT_MS);
		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: async () => {
				const sleep = (ms: number): Promise<void> =>
					new Promise((resolve) => window.setTimeout(resolve, ms));
				const deadline = Date.now() + 10_000;

				while (Date.now() < deadline) {
					const targetCount = document.querySelectorAll(
						"[class*='targets-container'] [class*='target-tile']"
					).length;
					if (targetCount > 0) {
						break;
					}
					await sleep(250);
				}

				return document.documentElement.outerHTML;
			},
		});
		const html = results[0]?.result;
		if (typeof html !== "string") {
			throw new Error("CSSBattle battle page HTML could not be read");
		}
		return html;
	} finally {
		await chrome.tabs.remove(tab.id).catch(() => {
			/* Tab may already be gone. */
		});
	}
};

const fetchHtml = async (url: string): Promise<string> => {
	try {
		return await readHydratedBattlePageHtml(url);
	} catch (tabError) {
		console.warn("CssHub: hydrated CSSBattle battle page read failed", tabError);
	}

	const response = await fetch(url, { credentials: "include" });
	if (!response.ok) {
		throw new Error(`CSSBattle battle metadata request failed (${response.status})`);
	}

	return response.text();
};

export const handleFetchCssbattleBattleMetadata: Handler<
	"fetchCssbattleBattleMetadata"
> = async (data, sendResponse) => {
	const state = await getStoredState();
	const result = await getCssbattleBattleMetadata(
		data.battleId,
		state.battleMetadataCache,
		fetchHtml
	);

	if (result.cache !== state.battleMetadataCache) {
		await saveStoredState({
			...state,
			battleMetadataCache: result.cache,
		});
	}

	sendResponse({
		ok: true,
		data: result.metadata,
	});
};
