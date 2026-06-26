// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	detectCaptureIssues,
	formatCaptureFailureReason,
	formatMissingFieldsList,
	getCaptureFailureTitle,
} from "@/contentScriptCaptureIssues";
import type { ChallengeContext } from "@/contentScriptChallengeContext";

const battleContext: ChallengeContext = {
	mode: "battle",
	crumbs: ["Battles", "Neon", "1"],
	battleId: "neon",
	battleGroup: "Neon",
	challengeLabel: "Target 1",
};

const completeInput = {
	challengeContext: battleContext,
	challengeId: "42",
	challengeName: "Target 1",
	stats: { score: 640, matchPct: 99.2, characterCount: 120 },
	code: "<div></div>",
	targetImage: { type: "url" as const, value: "https://cssbattle.dev/targets/42.png" },
	resultImageDataUrl: "data:image/png;base64,abc",
};

describe("formatMissingFieldsList", () => {
	it("joins user-facing labels", () => {
		expect(formatMissingFieldsList(["target-image", "preview-image", "last-score"])).toBe(
			"target image, preview image, Last score"
		);
	});
});

describe("formatCaptureFailureReason", () => {
	it("builds the standard missing-fields reason", () => {
		expect(formatCaptureFailureReason(["editor-code", "preview-image"])).toBe(
			"Could not capture submission: missing editor code, preview image"
		);
	});

	it("uses the unsupported-context variant for challenge metadata", () => {
		expect(
			formatCaptureFailureReason(["challenge-metadata"], { unsupportedContext: true })
		).toContain("missing challenge metadata");
	});
});

describe("detectCaptureIssues", () => {
	it("returns no issues for a complete capture payload", () => {
		expect(detectCaptureIssues(completeInput)).toEqual([]);
	});

	it("allows genuine zero score and match", () => {
		expect(
			detectCaptureIssues({
				...completeInput,
				stats: { score: 0, matchPct: 0, characterCount: 10 },
			})
		).toEqual([]);
	});

	it("flags unavailable score markers from the DOM", () => {
		document.body.innerHTML = `
			<div class="leaderboard-stats-box">
				<span>Last score</span>
				<span>-</span>
			</div>
		`;
		expect(
			detectCaptureIssues({
				...completeInput,
				stats: { score: 0, matchPct: 0, characterCount: null },
				documentRoot: document,
			})
		).toContain("last-score");
	});

	it("flags score without match percentage", () => {
		expect(
			detectCaptureIssues({
				...completeInput,
				stats: { score: 640, matchPct: null, characterCount: null },
			})
		).toContain("match-percentage");
	});

	it("flags empty code", () => {
		expect(detectCaptureIssues({ ...completeInput, code: "   " })).toContain("editor-code");
	});

	it("allows fallback challenge names like Target-42", () => {
		expect(
			detectCaptureIssues({
				...completeInput,
				challengeName: "Target-42",
			})
		).not.toContain("challenge-name");
	});

	it("flags unknown challenge id", () => {
		expect(detectCaptureIssues({ ...completeInput, challengeId: "unknown" })).toContain(
			"challenge-id"
		);
	});

	it("flags unsupported challenge context without waiting on other fields", () => {
		expect(
			detectCaptureIssues({
				...completeInput,
				challengeContext: { mode: "unsupported", crumbs: [] },
			})
		).toEqual(["challenge-metadata"]);
	});

	it("passes when only target image resolves via canonical URL payload", () => {
		expect(
			detectCaptureIssues({
				...completeInput,
				targetImage: { type: "url", value: "https://cssbattle.dev/targets/42.png" },
			})
		).not.toContain("target-image");
	});
});

describe("getCaptureFailureTitle", () => {
	it("prefers challenge name", () => {
		expect(getCaptureFailureTitle({ challengeName: "Neon 1", challengeId: "42" })).toBe(
			"Neon 1"
		);
	});

	it("falls back to challenge id", () => {
		expect(getCaptureFailureTitle({ challengeId: "42" })).toBe("#42");
	});

	it("uses generic title when context is unknown", () => {
		expect(getCaptureFailureTitle({})).toBe("Capture failed");
	});
});
