export const LAST_SCORE_LABEL = /last\s*score/i;
export const LAST_SCORE_LABEL_GLOBAL = /last\s*score/gi;
export const MATCH_REGEX = /(\d+(?:[.,]\d+)?)\s*%\s*(?:match)?/gi;
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
		return { score: null, matchPct: null };
	}

	const score = toNumber(scoreMatch[0]);
	const matchPct = matchPctMatch ? toNumber(matchPctMatch[1]) : 100;
	return {
		score,
		matchPct: score === null ? null : matchPct,
	};
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
			const parsed = parseScoreFromText(text);
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
			const parsed = parseScoreFromText(text);
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
