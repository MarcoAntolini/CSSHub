import { describe, expect, it } from "vitest";

import type { SubmissionPayload } from "@/shared/contracts";
import {
	battleManifestPathFromGroup,
	buildBattleManifestFromPayload,
	mergeBattleManifest,
	parseBattleManifest,
} from "@/submission/battleManifest";

const battlePayload = (): SubmissionPayload => ({
	challengeMode: "battle",
	challengeId: "6",
	challengeName: "Missing Slice",
	battleId: "1",
	battleGroup: "Battle #1",
	challengeLabel: "#6. Missing Slice",
	battleTotalChallenges: 12,
	battleStatus: "finished",
	challengeUrl: "https://cssbattle.dev/play/6",
	submittedAt: "2026-06-23T12:00:00.000Z",
	score: 100,
	matchPct: 99,
	characterCount: 236,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
});

describe("battle manifest", () => {
	it("uses the battle folder as the manifest location", () => {
		expect(battleManifestPathFromGroup("Battle #1")).toBe("Battles/Battle #1/battle.json");
	});

	it("builds a manifest from battle payload metadata", () => {
		expect(buildBattleManifestFromPayload(battlePayload())).toEqual({
			schemaVersion: 1,
			battleId: "1",
			battleGroup: "Battle #1",
			totalTargets: 12,
			status: "finished",
			fetchedAt: "2026-06-23T12:00:00.000Z",
			lastUpdatedFromTarget: "#6. Missing Slice",
		});
	});

	it("rejects payloads without known battle metadata", () => {
		expect(
			buildBattleManifestFromPayload({
				...battlePayload(),
				battleTotalChallenges: undefined,
				battleStatus: undefined,
			})
		).toBeNull();
	});

	it("parses valid manifests and rejects malformed content", () => {
		expect(
			parseBattleManifest(
				JSON.stringify({
					schemaVersion: 1,
					battleId: "1",
					battleGroup: "Battle #1",
					totalTargets: 12,
					status: "finished",
					fetchedAt: "2026-06-23T12:00:00.000Z",
					lastUpdatedFromTarget: "#6. Missing Slice",
				})
			)
		).toMatchObject({
			battleGroup: "Battle #1",
			totalTargets: 12,
			status: "finished",
		});
		expect(parseBattleManifest("{")).toBeNull();
		expect(parseBattleManifest(JSON.stringify({ battleGroup: "Battle #1" }))).toBeNull();
	});

	it("keeps finished manifests terminal", () => {
		const finished = buildBattleManifestFromPayload(battlePayload());
		const unfinished = buildBattleManifestFromPayload({
			...battlePayload(),
			battleTotalChallenges: 13,
			battleStatus: "unfinished",
		});

		expect(mergeBattleManifest(finished, unfinished)).toEqual(finished);
	});

	it("allows unfinished manifests to be refreshed", () => {
		const oldManifest = buildBattleManifestFromPayload({
			...battlePayload(),
			battleTotalChallenges: 11,
			battleStatus: "unfinished",
		});
		const nextManifest = buildBattleManifestFromPayload(battlePayload());

		expect(mergeBattleManifest(oldManifest, nextManifest)).toEqual(nextManifest);
	});
});
