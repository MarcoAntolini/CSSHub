import { describe, expect, it } from "vitest";
import type { SubmissionPayload } from "../../src/shared/contracts";
import {
	challengeFolderPath,
	formatChallengeTitle,
	listBestSubmissionMetadataPaths,
} from "../../src/submission/submissionFiles";

const battlePayload = (): SubmissionPayload => ({
	challengeMode: "battle",
	challengeId: "254",
	challengeName: "Unfitting",
	battleGroup: "Battle #39",
	challengeLabel: "#254. Unfitting",
	challengeUrl: "https://cssbattle.dev/play/254",
	submittedAt: new Date().toISOString(),
	score: 100,
	matchPct: 99,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
});

const dailyPayload = (): SubmissionPayload => ({
	challengeMode: "daily",
	challengeId: "17Bc6kIuAsiQgqP65moB",
	challengeName: "Jun 4, 2026",
	dailyDateIso: "2026-06-04",
	dailyDateLabel: "Jun 4, 2026",
	challengeUrl: "https://cssbattle.dev/play/17Bc6kIuAsiQgqP65moB",
	submittedAt: new Date().toISOString(),
	score: 100,
	matchPct: 99,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
});

describe("challengeFolderPath", () => {
	it("uses Battles hierarchy for battle mode", () => {
		expect(challengeFolderPath(battlePayload())).toBe(
			"Battles/Battle #39/#254. Unfitting"
		);
	});

	it("uses ISO date folder for daily mode", () => {
		expect(challengeFolderPath(dailyPayload())).toBe("Daily Targets/2026-06-04");
	});
});

describe("formatChallengeTitle", () => {
	it("uses challenge label for battles", () => {
		expect(formatChallengeTitle(battlePayload())).toBe("#254. Unfitting");
	});

	it("uses daily label for daily targets", () => {
		expect(formatChallengeTitle(dailyPayload())).toBe("Daily Target — Jun 4, 2026");
	});
});

describe("listBestSubmissionMetadataPaths", () => {
	it("includes new and legacy paths for battles", () => {
		expect(listBestSubmissionMetadataPaths(battlePayload())).toEqual([
			"Battles/Battle #39/#254. Unfitting/submission.json",
			"challenges/254/submission.json",
			"challenges/254-unfitting/submission.json",
		]);
	});

	it("includes new path only for non-numeric daily ids", () => {
		expect(listBestSubmissionMetadataPaths(dailyPayload())).toEqual([
			"Daily Targets/2026-06-04/submission.json",
			"challenges/17bc6kiuasiqgqp65mob-jun-4-2026/submission.json",
		]);
	});
});
