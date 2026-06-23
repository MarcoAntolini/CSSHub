import type { BattleStatus } from "./shared/contracts";

export type CssbattleBattleMetadata = {
	battleId: string;
	totalChallenges: number | null;
	status: BattleStatus;
	fetchedAt: string;
};

export type CssbattleBattleMetadataCache = Record<string, CssbattleBattleMetadata>;

export type ParsedCssbattleBattleMetadata = {
	totalChallenges: number | null;
	status: BattleStatus;
};

const TARGETS_CONTAINER_CLASS = "targets-container";
const TARGET_TILE_CLASS = "target-tile";
const STATUS_CLASS_PARTS = ["pill", "badge", "status"] as const;

const decodeHtmlText = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");

const extractTargetsRegion = (html: string): string => {
	const classIndex = html.toLowerCase().indexOf(TARGETS_CONTAINER_CLASS);
	if (classIndex === -1) {
		return html;
	}
	const openTagStart = html.lastIndexOf("<", classIndex);
	if (openTagStart === -1) {
		return html.slice(classIndex);
	}
	const openTag = html.slice(openTagStart).match(/^<([a-z][a-z0-9-]*)\b[^>]*>/i);
	const tagName = openTag?.[1]?.toLowerCase();
	if (!tagName) {
		return html.slice(openTagStart);
	}

	const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
	tagPattern.lastIndex = openTagStart;
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagPattern.exec(html)) !== null) {
		const tag = match[0];
		if (tag.startsWith("</")) {
			depth -= 1;
			if (depth === 0) {
				return html.slice(openTagStart, match.index + tag.length);
			}
			continue;
		}
		if (!tag.endsWith("/>")) {
			depth += 1;
		}
	}
	return html.slice(openTagStart);
};

const stripTags = (html: string): string => decodeHtmlText(html.replace(/<[^>]+>/g, " "));

const hasTargetsContainer = (html: string): boolean =>
	html.toLowerCase().includes(TARGETS_CONTAINER_CLASS);

const countTargetTiles = (html: string): number | null => {
	const region = extractTargetsRegion(html);
	const pattern = new RegExp(
		`<[^>]+\\bclass=(["'])[^"']*${TARGET_TILE_CLASS}[^"']*\\1`,
		"gi"
	);
	const count = [...region.matchAll(pattern)].length;
	return count > 0 ? count : null;
};

const countUniquePlayLinks = (html: string): number | null => {
	const region = extractTargetsRegion(html);
	const ids = new Set<string>();
	for (const match of region.matchAll(/<a\b[^>]*\bhref=(["'])\/play\/([^"'/?#]+)[^"']*\1/gi)) {
		ids.add(decodeURIComponent(match[2]));
	}
	return ids.size > 0 ? ids.size : null;
};

const parseStatusFromPill = (html: string): BattleStatus | null => {
	const statusClassPattern = STATUS_CLASS_PARTS.join("|");
	const elementPattern = new RegExp(
		`<[^>]+\\bclass=(["'])[^"']*(?:${statusClassPattern})[^"']*\\1[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
		"gi"
	);
	for (const match of html.matchAll(elementPattern)) {
		const text = stripTags(match[2]);
		if (/\bFINISHED\b/i.test(text)) {
			return "finished";
		}
		if (/\b(?:LIVE|ONGOING|OPEN|ACTIVE)\b/i.test(text)) {
			return "unfinished";
		}
	}
	return null;
};

const parseBattleStatus = (html: string): BattleStatus =>
	parseStatusFromPill(html) ?? (/\bFINISHED\b/i.test(stripTags(html)) ? "finished" : "unfinished");

export const parseCssbattleBattleMetadata = (
	html: string
): ParsedCssbattleBattleMetadata => ({
	totalChallenges: hasTargetsContainer(html)
		? (countTargetTiles(html) ?? countUniquePlayLinks(html))
		: null,
	status: parseBattleStatus(html),
});

export const getCssbattleBattleMetadata = async (
	battleId: string,
	cache: CssbattleBattleMetadataCache | undefined,
	fetchHtml: (url: string) => Promise<string>
): Promise<{
	metadata: CssbattleBattleMetadata | null;
	cache: CssbattleBattleMetadataCache;
}> => {
	const currentCache = cache ?? {};
	const cached = currentCache[battleId];
	if (cached?.status === "finished" && cached.totalChallenges !== null) {
		return { metadata: cached, cache: currentCache };
	}

	const html = await fetchHtml(`https://cssbattle.dev/battle/${encodeURIComponent(battleId)}`);
	const parsed = parseCssbattleBattleMetadata(html);
	const metadata: CssbattleBattleMetadata = {
		battleId,
		totalChallenges: parsed.totalChallenges,
		status: parsed.status,
		fetchedAt: new Date().toISOString(),
	};
	return {
		metadata,
		cache: {
			...currentCache,
			[battleId]: metadata,
		},
	};
};
