import { describe, expect, it, vi } from "vitest";
import type { SubmissionPayload } from "@/shared/contracts";
import {
	buildSubmissionFiles,
	challengeFolderPath,
	formatCommitMessage,
	formatChallengeTitle,
	listBestSubmissionMetadataPaths,
} from "@/submission/submissionFiles";

vi.mock("@/remoteImageFetch", () => ({
	fetchRemoteImageAsDataUrl: vi.fn(),
}));

import { fetchRemoteImageAsDataUrl } from "@/remoteImageFetch";

const battlePayload = (): SubmissionPayload => ({
	challengeMode: "battle",
	challengeId: "254",
	challengeName: "Unfitting",
	battleId: "39",
	battleGroup: "Battle #39",
	challengeLabel: "#254. Unfitting",
	battleTotalChallenges: 8,
	battleStatus: "finished",
	challengeUrl: "https://cssbattle.dev/play/254",
	submittedAt: new Date().toISOString(),
	score: 100,
	matchPct: 99,
	characterCount: 225,
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
	characterCount: 225,
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

describe("buildSubmissionFiles", () => {
	it("writes metadata, readme, and deletes legacy files", async () => {
		const files = await buildSubmissionFiles(battlePayload());
		const paths = files.map((file) => file.path);

		expect(paths).toContain("Battles/Battle #39/battle.json");
		expect(paths).toContain("Battles/Battle #39/#254. Unfitting/README.md");
		expect(paths).toContain("Battles/Battle #39/#254. Unfitting/submission.json");
		expect(paths).toContain("Battles/Battle #39/#254. Unfitting/solution.html");
		expect(files.find((file) => file.path.endsWith("solution.html"))).toMatchObject({
			delete: true,
		});

		const readme = files.find((file) => file.path.endsWith("README.md"));
		expect(readme && "content" in readme ? readme.content : "").toContain("Not available");

		const metadataFile = files.find((file) => file.path.endsWith("submission.json"));
		const metadata = JSON.parse(
			metadataFile && "content" in metadataFile ? metadataFile.content : "{}"
		) as Record<string, unknown>;
		expect(metadata.characterCount).toBe(225);
		expect(metadata.battleId).toBe("39");
		expect(metadata.battleTotalChallenges).toBe(8);
		expect(metadata.battleStatus).toBe("finished");

		const manifestFile = files.find((file) => file.path === "Battles/Battle #39/battle.json");
		const manifest = JSON.parse(
			manifestFile && "content" in manifestFile ? manifestFile.content : "{}"
		) as Record<string, unknown>;
		expect(manifest).toMatchObject({
			schemaVersion: 1,
			battleId: "39",
			battleGroup: "Battle #39",
			totalTargets: 8,
			status: "finished",
			lastUpdatedFromTarget: "#254. Unfitting",
		});
	});

	it("does not write a battle manifest when battle metadata is unknown", async () => {
		const files = await buildSubmissionFiles({
			...battlePayload(),
			battleTotalChallenges: undefined,
			battleStatus: undefined,
		});

		expect(files.map((file) => file.path)).not.toContain("Battles/Battle #39/battle.json");
	});

	it("falls back to code length when metadata has no character count", async () => {
		const files = await buildSubmissionFiles({
			...battlePayload(),
			characterCount: null,
			code: "<main></main>",
		});
		const metadataFile = files.find((file) => file.path.endsWith("submission.json"));
		const metadata = JSON.parse(
			metadataFile && "content" in metadataFile ? metadataFile.content : "{}"
		) as Record<string, unknown>;

		expect(metadata.characterCount).toBe("<main></main>".length);
	});

	it("embeds user and target images from data URLs", async () => {
		const files = await buildSubmissionFiles({
			...battlePayload(),
			code: "<div>hi</div>",
			resultImageDataUrl: "data:image/png;base64,USER",
			targetImage: { type: "dataUrl", value: "data:image/png;base64,TARGET" },
		});

		const user = files.find((file) => file.path.endsWith("/user.png"));
		const target = files.find((file) => file.path.endsWith("/target.png"));
		const readme = files.find((file) => file.path.endsWith("/README.md"));

		expect(user).toMatchObject({ encoding: "base64", content: "USER" });
		expect(target).toMatchObject({ encoding: "base64", content: "TARGET" });
		expect(readme && "content" in readme ? readme.content : "").toContain("./user.png");
		expect(readme && "content" in readme ? readme.content : "").toContain("./target.png");
	});

	it("fetches URL targets during file assembly", async () => {
		vi.mocked(fetchRemoteImageAsDataUrl).mockResolvedValue(
			"data:image/png;base64,REMOTE"
		);

		const files = await buildSubmissionFiles({
			...battlePayload(),
			targetImage: {
				type: "url",
				value: "https://cssbattle.dev/targets/254.png",
			},
		});

		expect(fetchRemoteImageAsDataUrl).toHaveBeenCalledWith(
			"https://cssbattle.dev/targets/254.png"
		);
		expect(files.find((file) => file.path.endsWith("/target.png"))).toMatchObject({
			encoding: "base64",
			content: "REMOTE",
		});
	});
});

describe("formatCommitMessage", () => {
	it("includes score, characters, and match", () => {
		expect(formatCommitMessage(640, 225, 99)).toBe(
			"Score: 640, Characters: 225 (99.00% match) - CSSHub"
		);
	});
});
