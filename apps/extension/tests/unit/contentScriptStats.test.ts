// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	didStatsChange,
	extractStatsFromDocument,
	parseScoreFromText,
} from "../../src/contentScriptStats";

const FIXTURE_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"../fixtures/cssbattle-play-minimal.html"
);

describe("parseScoreFromText", () => {
	it("parses score and match from leaderboard-style text", () => {
		const parsed = parseScoreFromText("640 99.2% match Last score");
		expect(parsed.score).toBe(640);
		expect(parsed.matchPct).toBe(99.2);
	});

	it("returns zero score when dash precedes label", () => {
		const parsed = parseScoreFromText("- Last score");
		expect(parsed.score).toBe(0);
		expect(parsed.matchPct).toBe(0);
	});
});

describe("extractStatsFromDocument", () => {
	beforeEach(() => {
		document.body.innerHTML = readFileSync(FIXTURE_PATH, "utf8");
	});

	it("reads stats from fixture DOM", () => {
		const stats = extractStatsFromDocument(document);
		expect(stats.score).toBe(640);
		expect(stats.matchPct).toBe(99.2);
	});
});

describe("didStatsChange", () => {
	it("detects score updates", () => {
		expect(
			didStatsChange(
				{ score: 100, matchPct: 90 },
				{ score: 50, matchPct: 90 }
			)
		).toBe(true);
	});

	it("detects newly available stats", () => {
		expect(didStatsChange({ score: 10, matchPct: 80 }, { score: null, matchPct: null })).toBe(
			true
		);
	});
});
