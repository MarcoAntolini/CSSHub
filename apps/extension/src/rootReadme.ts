import type { RepositoryReadmeMode } from "./shared/contracts";
import { folderFromSubmissionJsonPath } from "./submission/challengeModel";

export const CSSHUB_README_START = "<!-- CSSHUB:README-START -->";
export const CSSHUB_README_END = "<!-- CSSHUB:README-END -->";

const humanizeSlug = (slug: string): string =>
	slug
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

export type ChallengeIndexEntry = {
	folder: string;
	label: string;
};

export type ChallengeIndexBuckets = {
	battles: ChallengeIndexEntry[];
	daily: ChallengeIndexEntry[];
	legacy: ChallengeIndexEntry[];
};

export type BattleReadmeMetadata = {
	totalChallenges: number;
	status: "finished" | "unfinished";
};

export type ReadmeGenerationOptions = {
	generatedAt?: Date;
};

export const encodeRepoPathForMarkdownLink = (folder: string): string =>
	folder
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

export const extractBattleChallengeNumber = (folder: string): number | null => {
	const match = folder.match(/^Battles\/[^/]+\/#(\d+)\./);
	return match ? parseInt(match[1], 10) : null;
};

export const compareBattleEntries = (a: ChallengeIndexEntry, b: ChallengeIndexEntry): number => {
	const battleA = a.folder.match(/^Battles\/Battle #(\d+)\//)?.[1];
	const battleB = b.folder.match(/^Battles\/Battle #(\d+)\//)?.[1];
	if (battleA !== undefined && battleB !== undefined) {
		const cmp = parseInt(battleA, 10) - parseInt(battleB, 10);
		if (cmp !== 0) {
			return cmp;
		}
	}
	const challengeA = extractBattleChallengeNumber(a.folder);
	const challengeB = extractBattleChallengeNumber(b.folder);
	if (challengeA !== null && challengeB !== null) {
		return challengeA - challengeB;
	}
	return a.folder.localeCompare(b.folder);
};

export const compareDailyEntries = (a: ChallengeIndexEntry, b: ChallengeIndexEntry): number => {
	const isoA = a.folder.match(/^Daily Targets\/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? "";
	const isoB = b.folder.match(/^Daily Targets\/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? "";
	return isoA.localeCompare(isoB);
};

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export const extractDailyIsoFromFolder = (folder: string): string | null =>
	folder.match(/^Daily Targets\/(\d{4}-\d{2}-\d{2})$/)?.[1] ?? null;

export const extractDailyMonthKeyFromFolder = (folder: string): string | null => {
	const iso = extractDailyIsoFromFolder(folder);
	return iso ? iso.slice(0, 7) : null;
};

export const formatDailyDateLabelFromIso = (iso: string): string => {
	const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) {
		return iso;
	}
	const monthIndex = parseInt(match[2], 10) - 1;
	const day = parseInt(match[3], 10);
	const year = match[1];
	if (monthIndex < 0 || monthIndex > 11) {
		return iso;
	}
	return `${MONTH_NAMES[monthIndex].slice(0, 3)} ${day}, ${year}`;
};

export const formatMonthLabelFromKey = (monthKey: string): string => {
	const match = monthKey.match(/^(\d{4})-(\d{2})$/);
	if (!match) {
		return monthKey;
	}
	const monthIndex = parseInt(match[2], 10) - 1;
	if (monthIndex < 0 || monthIndex > 11) {
		return monthKey;
	}
	return `${MONTH_NAMES[monthIndex]} ${match[1]}`;
};

export const compareDailyMonthKeys = (a: string, b: string): number => a.localeCompare(b);

export const groupDailyEntriesByMonth = (
	entries: ChallengeIndexEntry[]
): { monthKey: string; monthLabel: string; entries: ChallengeIndexEntry[] }[] => {
	const byMonth = new Map<string, ChallengeIndexEntry[]>();
	for (const entry of entries) {
		const monthKey = extractDailyMonthKeyFromFolder(entry.folder) ?? "unknown";
		const list = byMonth.get(monthKey) ?? [];
		list.push(entry);
		byMonth.set(monthKey, list);
	}
	return [...byMonth.entries()]
		.sort(([monthA], [monthB]) => compareDailyMonthKeys(monthA, monthB))
		.map(([monthKey, monthEntries]) => ({
			monthKey,
			monthLabel: formatMonthLabelFromKey(monthKey),
			entries: [...monthEntries].sort(compareDailyEntries),
		}));
};

export const compareLegacyEntries = (a: ChallengeIndexEntry, b: ChallengeIndexEntry): number => {
	const numA = a.folder.match(/^challenges\/(\d+)$/)?.[1];
	const numB = b.folder.match(/^challenges\/(\d+)$/)?.[1];
	if (numA !== undefined && numB !== undefined) {
		return parseInt(numA, 10) - parseInt(numB, 10);
	}
	return a.folder.localeCompare(b.folder);
};

const README_MARKDOWN_LINK = /\[([^\]]+)\]\(\.\/([^)]+)\/\)/;
const README_HTML_LINK = /<a href="\.\/([^"]+)">([^<]*)<\/a>(\s+\(\d+ Characters\))?/gi;

const normalizeReadmeLinkPath = (path: string): string =>
	decodeURIComponent(path).replace(/\/$/, "");

const decodeHtmlText = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");

export const parseExistingReadmeLabels = (readme: string): Map<string, string> => {
	const labels = new Map<string, string>();
	for (const line of readme.split("\n")) {
		const match = line.match(README_MARKDOWN_LINK);
		if (match) {
			labels.set(normalizeReadmeLinkPath(match[2]), match[1]);
		}
	}
	for (const match of readme.matchAll(README_HTML_LINK)) {
		labels.set(
			normalizeReadmeLinkPath(match[1]),
			`${decodeHtmlText(match[2])}${match[3] ?? ""}`
		);
	}
	return labels;
};

export const deriveLabelFromLegacyKey = (key: string): string => {
	if (/^\d+$/.test(key)) {
		return `Target ${key}`;
	}
	const legacy = key.match(/^(\d+)-(.+)$/);
	if (legacy) {
		return `Target ${legacy[1]}: ${humanizeSlug(legacy[2])}`;
	}
	if (key.startsWith("unknown-")) {
		const rest = key.slice("unknown-".length);
		return rest ? `Unknown: ${humanizeSlug(rest)}` : "Unknown challenge";
	}
	return humanizeSlug(key);
};

export const collectChallengeIndexBuckets = (
	paths: Iterable<string>,
	currentFolder: string,
	currentTitle: string
): ChallengeIndexBuckets => {
	const battles = new Map<string, ChallengeIndexEntry>();
	const daily = new Map<string, ChallengeIndexEntry>();
	const legacy = new Map<string, ChallengeIndexEntry>();

	const upsert = (
		map: Map<string, ChallengeIndexEntry>,
		folder: string,
		label: string
	): void => {
		map.set(folder, { folder, label });
	};

	for (const path of paths) {
		const parsed = folderFromSubmissionJsonPath(path);
		if (!parsed) {
			continue;
		}
		if (parsed.kind === "battle") {
			upsert(battles, parsed.folder, parsed.label);
			continue;
		}
		if (parsed.kind === "daily") {
			upsert(daily, parsed.folder, formatDailyDateLabelFromIso(parsed.label));
			continue;
		}
		upsert(legacy, parsed.folder, deriveLabelFromLegacyKey(parsed.label));
	}

	if (currentFolder.startsWith("Battles/")) {
		upsert(battles, currentFolder, currentTitle);
	} else if (currentFolder.startsWith("Daily Targets/")) {
		const iso = extractDailyIsoFromFolder(currentFolder) ?? "";
		upsert(
			daily,
			currentFolder,
			currentTitle.replace(/^Daily Target — /, "") || formatDailyDateLabelFromIso(iso)
		);
	} else if (currentFolder.startsWith("challenges/")) {
		upsert(legacy, currentFolder, currentTitle);
	}

	const sortEntries = (
		entries: ChallengeIndexEntry[],
		compare: (a: ChallengeIndexEntry, b: ChallengeIndexEntry) => number
	): ChallengeIndexEntry[] => [...entries].sort(compare);

	return {
		battles: sortEntries([...battles.values()], compareBattleEntries),
		daily: sortEntries([...daily.values()], compareDailyEntries),
		legacy: sortEntries([...legacy.values()], compareLegacyEntries),
	};
};

const escapeHtmlText = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const splitCharacterCountLabel = (
	label: string
): { linkLabel: string; characterCountSuffix: string | null } => {
	const match = label.match(/^(.*?)\s+(\(\d+ Characters\))$/);
	return match
		? { linkLabel: match[1], characterCountSuffix: match[2] }
		: { linkLabel: label, characterCountSuffix: null };
};

/** HTML links render reliably inside nested <details> on GitHub; markdown does not. */
export const formatIndexLinkHtml = (entry: ChallengeIndexEntry): string => {
	const href = `./${encodeRepoPathForMarkdownLink(entry.folder)}/`;
	const { linkLabel, characterCountSuffix } = splitCharacterCountLabel(entry.label);
	const suffix = characterCountSuffix ? ` ${characterCountSuffix}` : "";
	return `<li><a href="${href}">${escapeHtmlText(linkLabel)}</a>${suffix}</li>`;
};

const formatIndexList = (entries: ChallengeIndexEntry[]): string =>
	["<ul>", ...entries.map(formatIndexLinkHtml), "</ul>"].join("\n");

export const formatSummaryHtml = (
	title: string,
	count: number,
	battleMetadata?: BattleReadmeMetadata
): string => {
	const progress = battleMetadata
		? `${count}/${battleMetadata.totalChallenges}${battleMetadata.status === "unfinished" ? "+" : ""}`
		: String(count);
	const label = `${title} (${progress})`;
	return `<summary><strong>${label}</strong></summary>`;
};

/** Markdown ### headings � reliable on GitHub (SVG foreignObject leaks raw &lt;style&gt; text). */
const formatTopLevelHeading = (title: string, count: number): string =>
	`### ${title} (${count})`;

const joinIndexBlock = (lines: string[]): string => lines.join("\n");

export const extractBattleGroupFromFolder = (folder: string): string | null => {
	const match = folder.match(/^Battles\/([^/]+)\//);
	return match?.[1] ?? null;
};

const compareBattleGroupNames = (a: string, b: string): number => {
	const numA = a.match(/^Battle #(\d+)$/i)?.[1];
	const numB = b.match(/^Battle #(\d+)$/i)?.[1];
	if (numA !== undefined && numB !== undefined) {
		return parseInt(numA, 10) - parseInt(numB, 10);
	}
	return a.localeCompare(b);
};

export const groupBattleEntriesByGroup = (
	entries: ChallengeIndexEntry[]
): { group: string; entries: ChallengeIndexEntry[] }[] => {
	const byGroup = new Map<string, ChallengeIndexEntry[]>();
	for (const entry of entries) {
		const group = extractBattleGroupFromFolder(entry.folder) ?? "Other";
		const list = byGroup.get(group) ?? [];
		list.push(entry);
		byGroup.set(group, list);
	}
	return [...byGroup.entries()]
		.sort(([groupA], [groupB]) => compareBattleGroupNames(groupA, groupB))
		.map(([group, groupEntries]) => ({
			group,
			entries: [...groupEntries].sort(compareBattleEntries),
		}));
};

const formatNestedBattleGroup = (
	battleGroup: string,
	entries: ChallengeIndexEntry[],
	battleMetadata?: BattleReadmeMetadata
): string =>
	joinIndexBlock([
		"<details>",
		formatSummaryHtml(battleGroup, entries.length, battleMetadata),
		"",
		formatIndexList(entries),
		"</details>",
	]);

const formatFlatTopLevelSection = (
	title: string,
	entries: ChallengeIndexEntry[]
): string | null => {
	if (entries.length === 0) {
		return null;
	}
	return joinIndexBlock([
		formatTopLevelHeading(title, entries.length),
		"",
		formatIndexList(entries),
	]);
};

const formatBattlesDetailsSection = (
	entries: ChallengeIndexEntry[],
	battleMetadataByGroup?: Map<string, BattleReadmeMetadata>
): string | null => {
	if (entries.length === 0) {
		return null;
	}
	const groups = groupBattleEntriesByGroup(entries);
	const nestedItems = groups
		.map(
			(group) =>
				`<li>\n${formatNestedBattleGroup(
					group.group,
					group.entries,
					battleMetadataByGroup?.get(group.group)
				)}\n</li>`
		)
		.join("\n");
	const hasUnfinishedProgress = groups.some(
		(group) => battleMetadataByGroup?.get(group.group)?.status === "unfinished"
	);

	return joinIndexBlock([
		formatTopLevelHeading("Battles", entries.length),
		...(hasUnfinishedProgress
			? ["", "_+ means this battle may receive more targets._"]
			: []),
		"",
		"<ul>",
		nestedItems,
		"</ul>",
	]);
};

const formatNestedDailyMonth = (
	monthKey: string,
	monthLabel: string,
	entries: ChallengeIndexEntry[],
	options?: ReadmeGenerationOptions
): string =>
	joinIndexBlock([
		"<details>",
		formatSummaryHtml(
			monthLabel,
			entries.length,
			buildDailyMonthReadmeMetadata(monthKey, options?.generatedAt ?? new Date())
		),
		"",
		formatIndexList(entries),
		"</details>",
	]);

const parseDailyMonthKey = (monthKey: string): { year: number; month: number } | null => {
	const match = monthKey.match(/^(\d{4})-(\d{2})$/);
	if (!match) {
		return null;
	}
	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	return month >= 1 && month <= 12 ? { year, month } : null;
};

const monthOrdinal = (year: number, month: number): number => year * 12 + month;

const daysInMonth = (year: number, month: number): number =>
	new Date(year, month, 0).getDate();

const buildDailyMonthReadmeMetadata = (
	monthKey: string,
	generatedAt: Date
): BattleReadmeMetadata | undefined => {
	const parsed = parseDailyMonthKey(monthKey);
	if (!parsed) {
		return undefined;
	}
	const totalDays = daysInMonth(parsed.year, parsed.month);
	const generatedYear = generatedAt.getFullYear();
	const generatedMonth = generatedAt.getMonth() + 1;
	const generatedDay = generatedAt.getDate();
	const dailyMonth = monthOrdinal(parsed.year, parsed.month);
	const currentMonth = monthOrdinal(generatedYear, generatedMonth);
	const isCurrentMonth = dailyMonth === currentMonth;
	const availableDays = isCurrentMonth ? Math.min(generatedDay, totalDays) : totalDays;

	return {
		totalChallenges: availableDays,
		status: isCurrentMonth && availableDays < totalDays ? "unfinished" : "finished",
	};
};

const formatDailyTargetsDetailsSection = (
	entries: ChallengeIndexEntry[],
	options?: ReadmeGenerationOptions
): string | null => {
	if (entries.length === 0) {
		return null;
	}
	const groups = groupDailyEntriesByMonth(entries);
	const nestedItems = groups
		.map(
			(group) =>
				`<li>\n${formatNestedDailyMonth(
					group.monthKey,
					group.monthLabel,
					group.entries,
					options
				)}\n</li>`
		)
		.join("\n");

	return joinIndexBlock([
		formatTopLevelHeading("Daily Targets", entries.length),
		"",
		"<ul>",
		nestedItems,
		"</ul>",
	]);
};

export const formatGroupedReadmeIndex = (
	buckets: ChallengeIndexBuckets,
	existingLabels?: Map<string, string>,
	battleMetadataByGroup?: Map<string, BattleReadmeMetadata>,
	options?: ReadmeGenerationOptions
): string => {
	const withLabels = (entries: ChallengeIndexEntry[]): ChallengeIndexEntry[] =>
		entries.map((entry) => ({
			...entry,
			label: existingLabels?.get(entry.folder) ?? entry.label,
		}));

	const sections = [
		formatBattlesDetailsSection(withLabels(buckets.battles), battleMetadataByGroup),
		formatDailyTargetsDetailsSection(withLabels(buckets.daily), options),
		formatFlatTopLevelSection("Legacy", withLabels(buckets.legacy)),
	].filter((section): section is string => section !== null);

	// Blank line between sections so ### headings parse after closing </ul> on GitHub.
	return joinIndexBlock(["## CssHub challenge index", "", sections.join("\n\n")]);
};

const buildManagedIndexBlock = (
	buckets: ChallengeIndexBuckets,
	existingLabels?: Map<string, string>,
	battleMetadataByGroup?: Map<string, BattleReadmeMetadata>,
	options?: ReadmeGenerationOptions
): string => formatGroupedReadmeIndex(buckets, existingLabels, battleMetadataByGroup, options);

export const injectManagedReadmeSection = (existing: string, indexBlock: string): string => {
	const trimmed = existing.trimEnd();
	const core = `${CSSHUB_README_START}\n${indexBlock.trim()}\n${CSSHUB_README_END}`;

	const startIdx = trimmed.indexOf(CSSHUB_README_START);
	const endIdx = trimmed.indexOf(CSSHUB_README_END);
	if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
		const before = trimmed.slice(0, startIdx).trimEnd();
		const after = trimmed.slice(endIdx + CSSHUB_README_END.length).trimStart();
		const parts = [before, core, after].filter((p) => p.length > 0);
		return `${parts.join("\n\n")}\n`;
	}
	if (!trimmed) {
		return `${core}\n`;
	}
	return `${trimmed}\n\n${core}\n`;
};

export const buildRootReadmeContent = (options: {
	mode: RepositoryReadmeMode;
	existingReadme: string | null;
	existingBlobPaths: Set<string>;
	challengeFolder: string;
	challengeTitle: string;
	battleMetadataByGroup?: Map<string, BattleReadmeMetadata>;
	generatedAt?: Date;
}): string | null => {
	if (options.mode === "off") {
		return null;
	}

	const buckets = collectChallengeIndexBuckets(
		options.existingBlobPaths,
		options.challengeFolder,
		options.challengeTitle
	);
	const existingLabels = options.existingReadme
		? parseExistingReadmeLabels(options.existingReadme)
		: undefined;
	existingLabels?.delete(options.challengeFolder);

	if (options.mode === "full") {
		return [
			"# CssHub — CSSBattle solutions",
			"",
			"_This README is fully managed while “Full” mode is enabled. Use “Managed section” in CssHub settings to keep your own text above the index._",
			"",
			buildManagedIndexBlock(buckets, existingLabels, options.battleMetadataByGroup, {
				generatedAt: options.generatedAt,
			}),
			"",
		].join("\n");
	}

	return injectManagedReadmeSection(
		options.existingReadme ?? "",
		buildManagedIndexBlock(buckets, existingLabels, options.battleMetadataByGroup, {
			generatedAt: options.generatedAt,
		})
	);
};

// Backward-compatible exports for tests that imported the old flat index helpers.
export const compareChallengeKeys = (a: string, b: string): number =>
	compareLegacyEntries(
		{ folder: `challenges/${a}`, label: a },
		{ folder: `challenges/${b}`, label: b }
	);

export const collectChallengeKeys = (
	paths: Iterable<string>,
	challengeFolder: string
): string[] => {
	const buckets = collectChallengeIndexBuckets(paths, challengeFolder, "");
	const keys = new Set<string>();
	for (const entry of [...buckets.battles, ...buckets.daily, ...buckets.legacy]) {
		if (entry.folder.startsWith("challenges/")) {
			keys.add(entry.folder.replace(/^challenges\//, ""));
		}
	}
	if (challengeFolder.startsWith("challenges/")) {
		keys.add(challengeFolder.replace(/^challenges\//, ""));
	}
	return [...keys].sort(compareChallengeKeys);
};

export const formatReadmeIndexLines = (
	keys: string[],
	currentKey: string,
	currentTitle: string,
	existingLabels?: Map<string, string>
): string => {
	const legacyEntries = keys.map((key) => ({
		folder: `challenges/${key}`,
		label:
			key === currentKey
				? currentTitle
				: (existingLabels?.get(`challenges/${key}`) ?? deriveLabelFromLegacyKey(key)),
	}));
	return formatIndexList(legacyEntries);
};
