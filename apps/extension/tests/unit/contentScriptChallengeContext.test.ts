// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	classifyChallengeContext,
	collectBreadcrumbTexts,
	detectChallengeContext,
	parseDailyDateLabelToIso,
} from "../../src/contentScriptChallengeContext";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

const loadFixture = (name: string): void => {
	const parsed = new DOMParser().parseFromString(
		readFileSync(join(FIXTURE_DIR, name), "utf8"),
		"text/html"
	);
	document.head.innerHTML = parsed.head.innerHTML;
	document.body.innerHTML = parsed.body.innerHTML;
	document.title = parsed.title;
};

describe("parseDailyDateLabelToIso", () => {
	it("parses Jun 4, 2026 to ISO", () => {
		expect(parseDailyDateLabelToIso("Jun 4, 2026")).toBe("2026-06-04");
	});

	it("returns null for invalid labels", () => {
		expect(parseDailyDateLabelToIso("not a date")).toBeNull();
		expect(parseDailyDateLabelToIso("32 Jan, 2026")).toBeNull();
	});
});

describe("classifyChallengeContext", () => {
	it("classifies regular battles", () => {
		const ctx = classifyChallengeContext(["Battles", "Battle #39", "#254. Unfitting"]);
		expect(ctx.mode).toBe("battle");
		if (ctx.mode === "battle") {
			expect(ctx.battleGroup).toBe("Battle #39");
			expect(ctx.challengeLabel).toBe("#254. Unfitting");
		}
	});

	it("classifies daily targets", () => {
		const ctx = classifyChallengeContext(["Daily Targets", "Jun 4, 2026"]);
		expect(ctx.mode).toBe("daily");
		if (ctx.mode === "daily") {
			expect(ctx.dailyDateIso).toBe("2026-06-04");
			expect(ctx.dailyDateLabel).toBe("Jun 4, 2026");
		}
	});

	it("marks unknown modes unsupported", () => {
		expect(classifyChallengeContext(["Versus", "Room 1"]).mode).toBe("unsupported");
		expect(classifyChallengeContext([]).mode).toBe("unsupported");
	});
});

describe("fixture breadcrumbs", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-battle.html");
	});

	it("detects battle context from battle fixture", () => {
		const ctx = detectChallengeContext(document);
		expect(ctx.mode).toBe("battle");
		if (ctx.mode === "battle") {
			expect(collectBreadcrumbTexts(document)).toEqual([
				"Battles",
				"Battle #39",
				"#254. Unfitting",
			]);
		}
	});
});

describe("daily fixture breadcrumbs", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-daily.html");
	});

	it("detects daily context from daily fixture", () => {
		const ctx = detectChallengeContext(document);
		expect(ctx.mode).toBe("daily");
		if (ctx.mode === "daily") {
			expect(ctx.dailyDateIso).toBe("2026-06-04");
		}
	});
});
