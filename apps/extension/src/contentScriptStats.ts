export const LAST_SCORE_LABEL = /last\s*score/i;
export const LAST_SCORE_LABEL_GLOBAL = /last\s*score/gi;
export const MATCH_REGEX = /(\d+(?:[.,]\d+)?)\s*%\s*(?:match)?/gi;
export const EXPLICIT_MATCH_REGEX = /(\d+(?:[.,]\d+)?)\s*%\s*match/gi;
export const NUMBER_REGEX = /\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi;
export const LEADERBOARD_STATS_BOX_SELECTOR = ".leaderboard-stats-box";

export type SubmissionStats = {
	score: number | null;
	matchPct: number | null;
};

const toNumber = (value: string): number | null => {
	const parsed = Number(value.replace(",", "."));
	return Number.isFinite(parsed) ? parsed : null;
};

const getLastMatchPct = (text: string, regex: RegExp): number | null => {
	const matchPctMatch = Array.from(text.matchAll(regex)).at(-1);
	return matchPctMatch ? toNumber(matchPctMatch[1]) : null;
};

const getScoreBeforeLabel = (beforeLabel: string): SubmissionStats | null => {
	if (/[-–—]\s*$/.test(beforeLabel)) {
		return { score: 0, matchPct: 0 };
	}

	const matchPctMatches = Array.from(beforeLabel.matchAll(MATCH_REGEX));
	const matchPctMatch = matchPctMatches.at(-1);
	const scoreSearchText = matchPctMatch
		? beforeLabel.slice(0, matchPctMatch.index).trim()
		: beforeLabel;
	const scoreMatches = Array.from(scoreSearchText.matchAll(NUMBER_REGEX));
	const scoreMatch = scoreMatches.at(-1);

	if (!scoreMatch) {
		return null;
	}

	const score = toNumber(scoreMatch[0]);
	const matchPct = matchPctMatch ? toNumber(matchPctMatch[1]) : null;
	return {
		score,
		matchPct: score === null ? null : matchPct,
	};
};

const getScoreAfterLabel = (afterLabel: string): SubmissionStats | null => {
	const searchText = afterLabel.replace(/\{[^}]*\}/g, " ").trim();
	if (/^[-–—](?:\s|$)/.test(searchText)) {
		return { score: 0, matchPct: 0 };
	}

	const scoreMatch = searchText.match(NUMBER_REGEX)?.at(0);
	if (!scoreMatch) {
		return null;
	}

	const score = toNumber(scoreMatch);
	const matchPct = getLastMatchPct(searchText, EXPLICIT_MATCH_REGEX);
	return {
		score,
		matchPct: score === null ? null : matchPct,
	};
};

const fillExplicitMatchPct = (stats: SubmissionStats, text: string): SubmissionStats =>
	stats.score !== null && stats.matchPct === null
		? { ...stats, matchPct: getLastMatchPct(text, EXPLICIT_MATCH_REGEX) }
		: stats;

const getRootText = (root: Document | Element): string =>
	(root instanceof Document ? root.documentElement : root).textContent
		?.replace(/\s+/g, " ")
		.trim() ?? "";

export const parseScoreFromText = (text: string): SubmissionStats => {
	const normalized = text.replace(/\s+/g, " ").trim();
	const labelMatches = Array.from(normalized.matchAll(LAST_SCORE_LABEL_GLOBAL));
	const lastLabelMatch = labelMatches.at(-1);
	if (!lastLabelMatch) {
		return { score: null, matchPct: null };
	}

	const beforeLabel = normalized
		.slice(0, lastLabelMatch.index)
		.replace(/\{[^}]*\}/g, " ")
		.trim();

	const beforeStats = getScoreBeforeLabel(beforeLabel);
	if (beforeStats) {
		return fillExplicitMatchPct(beforeStats, normalized);
	}

	const afterLabel = normalized.slice((lastLabelMatch.index ?? 0) + lastLabelMatch[0].length);
	const afterStats = getScoreAfterLabel(afterLabel);
	return afterStats ? fillExplicitMatchPct(afterStats, normalized) : { score: null, matchPct: null };
};

const getLastScoreLabelElements = (root: Document | Element): Element[] =>
	Array.from(root.querySelectorAll("body *")).filter((element) =>
		/^last\s*score$/i.test(element.textContent?.replace(/\s+/g, " ").trim() ?? "")
	);

export const extractStatsFromDocument = (root: Document | Element = document): SubmissionStats => {
	for (const labelElement of getLastScoreLabelElements(root)) {
		const statsBox = labelElement.closest(LEADERBOARD_STATS_BOX_SELECTOR);
		if (statsBox) {
			const text = statsBox.textContent?.replace(/\s+/g, " ").trim() ?? "";
			const parsed = fillExplicitMatchPct(parseScoreFromText(text), getRootText(root));
			if (parsed.score !== null || parsed.matchPct !== null) {
				return parsed;
			}
		}

		let candidate = labelElement.parentElement;
		while (
			candidate &&
			candidate !== (root instanceof Document ? root.body : null) &&
			candidate !== root
		) {
			const text = candidate.textContent?.replace(/\s+/g, " ").trim() ?? "";
			const parsed = fillExplicitMatchPct(parseScoreFromText(text), getRootText(root));
			if (parsed.score !== null || parsed.matchPct !== null) {
				return parsed;
			}
			candidate = candidate.parentElement;
		}
	}

	const relevantRoots = Array.from(root.querySelectorAll("section, div, article, main"))
		.map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
		.filter((text) => LAST_SCORE_LABEL.test(text))
		.sort((left, right) => left.length - right.length);

	for (const text of relevantRoots) {
		const parsed = parseScoreFromText(text);
		if (parsed.score !== null || parsed.matchPct !== null) {
			return parsed;
		}
	}

	return { score: null, matchPct: null };
};

export const didStatsChange = (
	current: SubmissionStats,
	initial: SubmissionStats
): boolean => {
	const scoreChanged = current.score !== initial.score;
	const matchChanged = current.matchPct !== initial.matchPct;
	const becameAvailable =
		(initial.score === null && current.score !== null) ||
		(initial.matchPct === null && current.matchPct !== null);

	return scoreChanged || matchChanged || becameAvailable;
};

/** True when the page already shows a scored result (not dash / unavailable). */
export const hasDisplayableScore = (stats: SubmissionStats): boolean =>
	typeof stats.score === "number" && Number.isFinite(stats.score) && stats.score > 0;

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

export type WaitForPostSubmitStatsOptions = {
	settleDelayMs?: number;
	timeoutMs?: number;
	pollIntervalMs?: number;
	mutationSettleMs?: number;
};

/** Wait until post-submit stats update or the leaderboard box re-renders after submit. */
export const waitForPostSubmitStats = async (
	root: Document | Element = document,
	initial: SubmissionStats,
	options: WaitForPostSubmitStatsOptions = {}
): Promise<SubmissionStats> => {
	const settleDelayMs = options.settleDelayMs ?? 750;
	const timeoutMs = options.timeoutMs ?? 20_000;
	const pollIntervalMs = options.pollIntervalMs ?? 300;
	const mutationSettleMs = options.mutationSettleMs ?? 300;

	await sleep(settleDelayMs);

	const deadline = Date.now() + timeoutMs;
	let latest = extractStatsFromDocument(root);
	let statsMutated = false;
	let mutationTimer: ReturnType<typeof setTimeout> | null = null;

	const tryResolveOnChange = (): SubmissionStats | null => {
		latest = extractStatsFromDocument(root);
		if (didStatsChange(latest, initial)) {
			return latest;
		}
		return null;
	};

	const changed = tryResolveOnChange();
	if (changed) {
		return changed;
	}

	return new Promise((resolve) => {
		let settled = false;
		let pollId: ReturnType<typeof setInterval> | null = null;
		let observer: MutationObserver | null = null;

		const cleanup = () => {
			observer?.disconnect();
			if (pollId) {
				clearInterval(pollId);
			}
			if (mutationTimer) {
				clearTimeout(mutationTimer);
			}
		};

		const settle = (stats: SubmissionStats) => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			resolve(stats);
		};

		const statsBox = root.querySelector(LEADERBOARD_STATS_BOX_SELECTOR);

		if (statsBox) {
			observer = new MutationObserver(() => {
				statsMutated = true;
				if (mutationTimer) {
					clearTimeout(mutationTimer);
				}
				mutationTimer = setTimeout(() => {
					const onChange = tryResolveOnChange();
					if (onChange) {
						settle(onChange);
						return;
					}
					// DOM re-rendered but values unchanged (e.g. identical resubmit score).
					settle(extractStatsFromDocument(root));
				}, mutationSettleMs);
			});
			observer.observe(statsBox, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}

		pollId = setInterval(() => {
			if (Date.now() >= deadline) {
				if (!statsMutated && !didStatsChange(latest, initial)) {
					// Resubmit while a last score is already visible: CSSBattle may not
					// re-render the box. Still process with on-page stats so threshold,
					// duplicate, and not-improved checks can decide the outcome.
					const current = extractStatsFromDocument(root);
					settle(
						hasDisplayableScore(current)
							? current
							: hasDisplayableScore(initial)
								? initial
								: { score: null, matchPct: null }
					);
					return;
				}
				settle(extractStatsFromDocument(root));
				return;
			}

			const onChange = tryResolveOnChange();
			if (onChange) {
				settle(onChange);
			}
		}, pollIntervalMs);
	});
};
