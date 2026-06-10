// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	didStatsChange,
	extractStatsFromDocument,
	hasDisplayableScore,
	parseScoreFromText,
	waitForPostSubmitStats,
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

	it("returns null match when score exists but percent is missing", () => {
		const parsed = parseScoreFromText("640 Last score");
		expect(parsed.score).toBe(640);
		expect(parsed.matchPct).toBeNull();
	});

	it("parses score when CSSBattle renders the value after the label", () => {
		const parsed = parseScoreFromText("Last score 648.85 (225)");
		expect(parsed.score).toBe(648.85);
		expect(parsed.matchPct).toBeNull();
	});
});

const loadFixture = (): void => {
	const parsed = new DOMParser().parseFromString(
		readFileSync(FIXTURE_PATH, "utf8"),
		"text/html"
	);
	document.head.innerHTML = parsed.head.innerHTML;
	document.body.innerHTML = parsed.body.innerHTML;
	document.title = parsed.title;
};

describe("extractStatsFromDocument", () => {
	beforeEach(() => {
		loadFixture();
	});

	it("reads stats from fixture DOM", () => {
		const stats = extractStatsFromDocument(document);
		expect(stats.score).toBe(640);
		expect(stats.matchPct).toBe(99.2);
	});

	it("reads stats from the current CSSBattle label-before-value DOM", () => {
		document.body.innerHTML = `
			<div class="leaderboard-stats-box">
				<span>Last score</span>
				<strong>648.85</strong>
				<span>(225)</span>
				<span>High score</span>
				<strong>648.85</strong>
				<span>(225)</span>
			</div>
			<div>New highscore! You scored 648.85 with 100% match</div>
		`;

		const stats = extractStatsFromDocument(document);
		expect(stats.score).toBe(648.85);
		expect(stats.matchPct).toBe(100);
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

describe("waitForPostSubmitStats", () => {
	beforeEach(() => {
		loadFixture();
	});

	it("returns updated stats when the leaderboard box mutates", async () => {
		const initial = extractStatsFromDocument(document);
		const promise = waitForPostSubmitStats(document, initial, {
			settleDelayMs: 10,
			pollIntervalMs: 20,
			mutationSettleMs: 20,
			timeoutMs: 2_000,
		});

		window.setTimeout(() => {
			const box = document.querySelector(".leaderboard-stats-box");
			if (!box) {
				return;
			}
			const spans = Array.from(box.querySelectorAll("span"));
			if (spans[0]) {
				spans[0].textContent = "700";
			}
			if (spans[1]) {
				spans[1].textContent = "88% match";
			}
		}, 80);

		const stats = await promise;
		expect(stats.score).toBe(700);
		expect(stats.matchPct).toBe(88);
	});

	it("returns existing page stats on timeout when the leaderboard never updates", async () => {
		const initial = extractStatsFromDocument(document);
		const stats = await waitForPostSubmitStats(document, initial, {
			settleDelayMs: 10,
			pollIntervalMs: 20,
			timeoutMs: 120,
		});
		expect(stats).toEqual({ score: 640, matchPct: 99.2 });
	});

	it("returns null stats on timeout when no score was on the page", async () => {
		document.body.innerHTML = `
			<div class="leaderboard-stats-box">
				<span>-</span>
				<span>Last score</span>
			</div>
		`;
		const initial = extractStatsFromDocument(document);
		expect(hasDisplayableScore(initial)).toBe(false);

		const stats = await waitForPostSubmitStats(document, initial, {
			settleDelayMs: 10,
			pollIntervalMs: 20,
			timeoutMs: 120,
		});
		expect(stats).toEqual({ score: null, matchPct: null });
	});

	it("accepts unchanged stats after a leaderboard mutation", async () => {
		const initial = extractStatsFromDocument(document);
		const promise = waitForPostSubmitStats(document, initial, {
			settleDelayMs: 10,
			pollIntervalMs: 20,
			mutationSettleMs: 20,
			timeoutMs: 2_000,
		});

		window.setTimeout(() => {
			const box = document.querySelector(".leaderboard-stats-box");
			if (!box) {
				return;
			}
			box.append(document.createElement("span"));
		}, 80);

		const stats = await promise;
		expect(stats.score).toBe(640);
		expect(stats.matchPct).toBe(99.2);
	});
});
