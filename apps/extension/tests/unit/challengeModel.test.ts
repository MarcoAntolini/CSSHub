import { describe, expect, it } from "vitest";
import type { SubmissionPayload } from "@/shared/contracts";
import {
	challengeFolderPath,
	challengeIdentityKey,
	folderFromSubmissionJsonPath,
	formatChallengeTitle,
	listBestSubmissionMetadataPaths,
} from "@/submission/challengeModel";

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
	characterCount: 225,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
});

describe("challengeIdentityKey", () => {
	it("uses battle group and label for battle mode", () => {
		expect(challengeIdentityKey(battlePayload())).toBe(
			"battle:Battle #39:#254. Unfitting"
		);
	});
});

describe("folderFromSubmissionJsonPath", () => {
	it("parses battle submission paths", () => {
		expect(
			folderFromSubmissionJsonPath("Battles/Battle #39/#254. Unfitting/submission.json")
		).toEqual({
			kind: "battle",
			folder: "Battles/Battle #39/#254. Unfitting",
			label: "#254. Unfitting",
		});
	});
});

describe("challenge model paths", () => {
	it("keeps folder and metadata paths aligned", () => {
		const payload = battlePayload();
		expect(challengeFolderPath(payload)).toBe("Battles/Battle #39/#254. Unfitting");
		expect(listBestSubmissionMetadataPaths(payload)[0]).toBe(
			"Battles/Battle #39/#254. Unfitting/submission.json"
		);
		expect(formatChallengeTitle(payload)).toBe("#254. Unfitting");
	});
});
