import type { BattleStatus } from "./shared/contracts";

export const BATTLE_PAGE_LOAD_TIMEOUT_MS = 15_000;
export const BATTLE_METADATA_POLL_TIMEOUT_MS = 12_000;
export const BATTLE_METADATA_POLL_INTERVAL_MS = 250;
export const BATTLE_METADATA_STABLE_TICKS = 3;

export type HydratedBattlePageMetadata = {
	totalChallenges: number | null;
	status: BattleStatus | null;
};

export const normalizeHydratedBattlePageMetadata = (
	value: unknown
): HydratedBattlePageMetadata | null => {
	if (!value || typeof value !== "object") {
		return null;
	}
	const metadata = value as Partial<HydratedBattlePageMetadata>;
	const totalChallenges = metadata.totalChallenges;
	const status = metadata.status;
	return {
		totalChallenges:
			typeof totalChallenges === "number" && Number.isInteger(totalChallenges)
				? totalChallenges
				: null,
		status: status === "finished" || status === "unfinished" ? status : null,
	};
};

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
