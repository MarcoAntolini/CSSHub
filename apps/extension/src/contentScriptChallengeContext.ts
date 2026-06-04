/** Challenge mode and breadcrumb metadata from the CSSBattle play page header. */

export const BREADCRUMB_CONTAINER_SELECTOR = '[class*="breadcrumbs"]';

export type ChallengeMode = "battle" | "daily" | "unsupported";

export type SupportedChallengeContext = {
	mode: "battle";
	crumbs: string[];
	battleGroup: string;
	challengeLabel: string;
};

export type DailyChallengeContext = {
	mode: "daily";
	crumbs: string[];
	dailyDateLabel: string;
	dailyDateIso: string;
};

export type UnsupportedChallengeContext = {
	mode: "unsupported";
	crumbs: string[];
};

export type ChallengeContext =
	| SupportedChallengeContext
	| DailyChallengeContext
	| UnsupportedChallengeContext;

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

const dedupeAdjacent = (items: string[]): string[] =>
	items.filter((item, index) => index === 0 || item !== items[index - 1]);

export const parseDailyDateLabelToIso = (label: string): string | null => {
	const match = label.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
	if (!match) {
		return null;
	}
	const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
	if (month === undefined) {
		return null;
	}
	const day = Number.parseInt(match[2], 10);
	const year = Number.parseInt(match[3], 10);
	if (!Number.isFinite(day) || !Number.isFinite(year) || day < 1 || day > 31) {
		return null;
	}
	const date = new Date(Date.UTC(year, month, day));
	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month ||
		date.getUTCDate() !== day
	) {
		return null;
	}
	const monthPart = String(month + 1).padStart(2, "0");
	const dayPart = String(day).padStart(2, "0");
	return `${year}-${monthPart}-${dayPart}`;
};

export const collectBreadcrumbTexts = (root: Document | Element): string[] => {
	const container = root.querySelector(BREADCRUMB_CONTAINER_SELECTOR);
	if (!container) {
		return [];
	}

	const fromControls = Array.from(container.querySelectorAll("a, button"))
		.map((element) => element.textContent?.trim() ?? "")
		.filter((text) => text.length > 0);

	if (fromControls.length >= 2) {
		return dedupeAdjacent(fromControls);
	}

	const rawText =
		(container as HTMLElement).innerText ??
		container.textContent ??
		"";
	const lines = rawText
		.split(/\n+/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	return dedupeAdjacent(lines);
};

export const classifyChallengeContext = (crumbs: string[]): ChallengeContext => {
	if (crumbs.length === 0) {
		return { mode: "unsupported", crumbs };
	}

	const first = crumbs[0].trim();
	if (/^battles$/i.test(first) && crumbs.length >= 3) {
		return {
			mode: "battle",
			crumbs,
			battleGroup: crumbs[1].trim(),
			challengeLabel: crumbs[2].trim(),
		};
	}

	if (/^daily targets$/i.test(first) && crumbs.length >= 2) {
		const dailyDateLabel = crumbs[1].trim();
		const dailyDateIso = parseDailyDateLabelToIso(dailyDateLabel);
		if (!dailyDateIso) {
			return { mode: "unsupported", crumbs };
		}
		return {
			mode: "daily",
			crumbs,
			dailyDateLabel,
			dailyDateIso,
		};
	}

	return { mode: "unsupported", crumbs };
};

export const detectChallengeContext = (
	root: Document | Element = document
): ChallengeContext => classifyChallengeContext(collectBreadcrumbTexts(root));
