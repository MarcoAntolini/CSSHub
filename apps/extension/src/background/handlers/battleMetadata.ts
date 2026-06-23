import { getCssbattleBattleMetadata } from "@/cssbattleBattleMetadata";
import { getStoredState, saveStoredState } from "@/storage";
import type { BattleStatus } from "@/shared/contracts";
import type { Handler } from "./types";

const BATTLE_PAGE_LOAD_TIMEOUT_MS = 15_000;
const BATTLE_METADATA_POLL_TIMEOUT_MS = 12_000;
const BATTLE_METADATA_POLL_INTERVAL_MS = 250;
const BATTLE_METADATA_STABLE_TICKS = 3;

type HydratedBattlePageMetadata = {
	totalChallenges: number | null;
	status: BattleStatus | null;
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

export const pollHydratedBattlePageMetadata = async (
	timeoutMs = BATTLE_METADATA_POLL_TIMEOUT_MS,
	intervalMs = BATTLE_METADATA_POLL_INTERVAL_MS,
	stableTicksRequired = BATTLE_METADATA_STABLE_TICKS
): Promise<HydratedBattlePageMetadata> => {
	const sleep = (ms: number): Promise<void> =>
		new Promise((resolve) => window.setTimeout(resolve, ms));
	const extract = (): HydratedBattlePageMetadata & { loading: boolean } => {
		const root =
			document.querySelector("[class*='targets-container']") ??
			document.querySelector("[class*='battle']") ??
			document.body;
		const ids = new Set<string>();
		for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href*='/play/']"))) {
			const match = anchor.getAttribute("href")?.match(/\/play\/([^/?#]+)/i);
			if (match?.[1]) {
				ids.add(decodeURIComponent(match[1]));
			}
		}
		const tileCount = root.querySelectorAll("[class*='target-tile']").length;
		const count = ids.size || tileCount || null;
		const statusText = Array.from(
			document.querySelectorAll("[class*='pill'], [class*='badge'], [class*='status']")
		)
			.map((element) => element.textContent ?? "")
			.join(" ");
		const pageText = document.body?.textContent ?? "";
		const text = `${statusText} ${pageText}`;
		const status = /\bFINISHED\b/i.test(text)
			? "finished"
			: /\b(?:LIVE|ONGOING|OPEN|ACTIVE)\b/i.test(text)
				? "unfinished"
				: null;
		const loading = /\b(?:loading|fetching|skeleton)\b/i.test(pageText);
		return {
			totalChallenges: count,
			status,
			loading,
		};
	};

	const deadline = Date.now() + timeoutMs;
	let lastCount: number | null = null;
	let stableTicks = 0;
	let best: HydratedBattlePageMetadata = {
		totalChallenges: null,
		status: null,
	};

	while (Date.now() < deadline) {
		const current = extract();
		if (current.totalChallenges !== null) {
			best = {
				totalChallenges: current.totalChallenges,
				status: current.status ?? best.status,
			};
			stableTicks =
				current.totalChallenges === lastCount && !current.loading
					? stableTicks + 1
					: 1;
			lastCount = current.totalChallenges;
			if (stableTicks >= stableTicksRequired) {
				return best;
			}
		}
		await sleep(intervalMs);
	}

	return best;
};

const readHydratedBattlePageMetadata = async (
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
		const metadata = results[0]?.result;
		if (!metadata || typeof metadata !== "object") {
			throw new Error("CSSBattle battle page metadata could not be read");
		}
		const totalChallenges = metadata.totalChallenges;
		const status = metadata.status;
		return {
			totalChallenges:
				typeof totalChallenges === "number" && Number.isInteger(totalChallenges)
					? totalChallenges
					: null,
			status: status === "finished" || status === "unfinished" ? status : null,
		};
	} finally {
		await chrome.tabs.remove(tab.id).catch(() => {
			/* Tab may already be gone. */
		});
	}
};

const fetchHtml = async (url: string): Promise<string> => {
	try {
		const metadata = await readHydratedBattlePageMetadata(url);
		if (metadata.totalChallenges !== null) {
			return [
				"<section class=\"targets-container\">",
				...Array.from({ length: metadata.totalChallenges }, (_, index) =>
					`<a href="/play/${index + 1}" class="target-tile"></a>`
				),
				"</section>",
				metadata.status ? `<span class="battle-status-pill">${metadata.status}</span>` : "",
			].join("");
		}
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
