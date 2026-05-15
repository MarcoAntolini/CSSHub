import type { RepositoryReadmeMode } from "./shared/contracts";

export const CSSHUB_README_START = "<!-- CSSHUB:README-START -->";
export const CSSHUB_README_END = "<!-- CSSHUB:README-END -->";

const SUBMISSION_JSON = /^challenges\/([^/]+)\/submission\.json$/;

const humanizeSlug = (slug: string): string =>
	slug
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

export const compareChallengeKeys = (a: string, b: string): number => {
	const numA = a.match(/^(\d+)/)?.[1];
	const numB = b.match(/^(\d+)/)?.[1];
	if (numA !== undefined && numB !== undefined) {
		const cmp = parseInt(numA, 10) - parseInt(numB, 10);
		if (cmp !== 0) {
			return cmp;
		}
	}
	return a.localeCompare(b);
};

export const deriveLabelFromSlug = (key: string): string => {
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

export const collectChallengeKeys = (
	paths: Iterable<string>,
	challengeFolder: string
): string[] => {
	const keys = new Set<string>();
	for (const p of paths) {
		const m = p.match(SUBMISSION_JSON);
		if (m) {
			keys.add(m[1]);
		}
	}
	const currentKey = challengeFolder.replace(/^challenges\//, "");
	keys.add(currentKey);
	return [...keys].sort(compareChallengeKeys);
};

export const formatReadmeIndexLines = (
	keys: string[],
	currentKey: string,
	currentTitle: string
): string =>
	keys
		.map((key) => {
			const label = key === currentKey ? currentTitle : deriveLabelFromSlug(key);
			return `- [${label}](./challenges/${key}/)`;
		})
		.join("\n");

const buildManagedIndexBlock = (
	keys: string[],
	currentKey: string,
	currentTitle: string
): string =>
	["## CssHub challenge index", "", formatReadmeIndexLines(keys, currentKey, currentTitle)].join(
		"\n"
	);

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
}): string | null => {
	if (options.mode === "off") {
		return null;
	}

	const currentKey = options.challengeFolder.replace(/^challenges\//, "");
	const keys = collectChallengeKeys(options.existingBlobPaths, options.challengeFolder);

	if (options.mode === "full") {
		const lines = formatReadmeIndexLines(keys, currentKey, options.challengeTitle);
		return [
			"# CssHub — CSSBattle solutions",
			"",
			"_This README is fully managed while “Full” mode is enabled. Use “Managed section” in CssHub settings to keep your own text above the index._",
			"",
			"## Challenge index",
			"",
			lines,
			"",
		].join("\n");
	}

	const indexBlock = buildManagedIndexBlock(keys, currentKey, options.challengeTitle);
	return injectManagedReadmeSection(options.existingReadme ?? "", indexBlock);
};
