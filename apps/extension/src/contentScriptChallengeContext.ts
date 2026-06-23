/** Challenge mode and breadcrumb metadata from the CSSBattle play page header. */

import type { BattleStatus } from "./shared/contracts";

export const BREADCRUMB_CONTAINER_SELECTOR = '[class*="breadcrumbs"]';

export type ChallengeMode = "battle" | "daily" | "unsupported";

export type SupportedChallengeContext = {
	mode: "battle";
	crumbs: string[];
	battleId?: string;
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

export const extractBattleIdFromHref = (href: string | null): string | null => {
	const match = href?.match(/\/battles?\/(\d+)(?:[/?#]|$)/i);
	return match?.[1] ?? null;
};

export const extractPlayIdFromHref = (href: string | null): string | null => {
	const match = href?.match(/\/play\/([^/?#]+)(?:[/?#]|$)/i);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
};

export const extractBattleChallengeCountFromDocument = (
	root: Document | Element
): number | null => {
	const ids = new Set<string>();
	const selectors = [
		".dropdown-menu a[href*='/play/']",
		"[class*='dropdown-menu'] a[href*='/play/']",
		"[class*='targets-container'] a[href*='/play/']",
		"[class*='battle'] a[href*='/play/']",
	];
	for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>(selectors.join(",")))) {
		const playId = extractPlayIdFromHref(anchor.getAttribute("href"));
		if (playId) {
			ids.add(playId);
		}
	}
	return ids.size > 0 ? ids.size : null;
};

export const extractBattleStatusFromDocument = (
	root: Document | Element
): BattleStatus | null => {
	const text =
		root instanceof Document
			? (root.body?.textContent ?? root.documentElement?.textContent ?? "")
			: (root.textContent ?? "");
	return /\bFINISHED\b/i.test(text) ? "finished" : null;
};

const collectBattleId = (root: Document | Element): string | null => {
	const container = root.querySelector(BREADCRUMB_CONTAINER_SELECTOR);
	if (!container) {
		return null;
	}
	for (const anchor of Array.from(container.querySelectorAll("a[href]"))) {
		const battleId = extractBattleIdFromHref(anchor.getAttribute("href"));
		if (battleId) {
			return battleId;
		}
	}
	return null;
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
): ChallengeContext => {
	const context = classifyChallengeContext(collectBreadcrumbTexts(root));
	if (context.mode !== "battle") {
		return context;
	}
	return {
		...context,
		battleId: collectBattleId(root) ?? undefined,
	};
};
