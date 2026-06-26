import type { SubmissionPayload } from "@/shared/contracts";
import type { CommitFile } from "@/githubClient";
import type { StoredState } from "@/storage";
import {
	SKIP_FAST_PATH_BUDGET_MS,
	fingerprintSubmission,
	hasPositiveLastScore,
	isDuplicateSubmission,
	processCssbattleSubmission,
} from "@/submission/syncSubmission";
import { describe, expect, it, vi } from "vitest";

const basePayload = (): SubmissionPayload => ({
	challengeMode: "battle",
	challengeId: "42",
	challengeName: "Carrom",
	battleGroup: "Battle #1",
	challengeLabel: "#42. Carrom",
	challengeUrl: "https://cssbattle.dev/play/42",
	submittedAt: new Date().toISOString(),
	score: 640,
	matchPct: 99,
	characterCount: 225,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: "data:image/png;base64,USER",
});

const baseState = (overrides: Partial<StoredState> = {}): StoredState => ({
	githubToken: "gh_test",
	auth: {
		isAuthenticated: true,
		username: "qa-user",
		method: "pat",
	},
	settings: {
		threshold: 95,
		selectedRepoFullName: "qa-user/csshub-test",
		selectedBranch: "main",
		systemNotificationsEnabled: true,
		repositoryReadmeMode: "off",
	},
	lastSubmission: null,
	lastSubmissionAccepted: null,
	lastIngestion: null,
	submissionProcessing: false,
	recentEvents: [],
	lastSubmissionFingerprint: null,
	battleMetadataCache: {},
	lastCaptureFailure: null,
	...overrides,
});

const noopDeps = () => ({
	readBestSubmissionMetrics: vi.fn().mockResolvedValue(null),
	buildSubmissionFiles: vi.fn().mockResolvedValue([
		{
			path: "challenges/42/submission.json",
			content: "{}",
			encoding: "utf-8" as const,
		},
	]),
	listBranchBlobPaths: vi.fn().mockResolvedValue(new Set<string>()),
	fetchRepoUtf8File: vi.fn().mockResolvedValue(null),
	commitFilesToRepo: vi.fn().mockResolvedValue({
		commitSha: "abc",
		commitUrl: "https://github.com/qa-user/csshub-test/commit/abc",
	}),
	challengeFolderPath: () => "Battles/Battle #1/#42. Carrom",
	formatChallengeTitle: () => "#42. Carrom",
	formatCommitMessage: vi.fn(
		() => "Score: 640, Characters: 225 (99.00% match) - CSSHub"
	),
});

describe("submission helpers", () => {
	it("detects positive scores", () => {
		expect(hasPositiveLastScore(basePayload())).toBe(true);
	});

	it("detects duplicates within the window", () => {
		const payload = basePayload();
		const fingerprint = fingerprintSubmission(payload);
		expect(
			isDuplicateSubmission(
				payload,
				{ ...payload, submittedAt: new Date(Date.now() - 1000).toISOString() },
				fingerprint
			)
		).toBe(true);
	});

	it("includes character count in duplicate fingerprints", () => {
		const payload = basePayload();
		expect(fingerprintSubmission(payload)).not.toBe(
			fingerprintSubmission({ ...payload, characterCount: 226 })
		);
	});
});

describe("processCssbattleSubmission", () => {
	it("skips below threshold without GitHub calls", async () => {
		const deps = noopDeps();
		const started = performance.now();
		const result = await processCssbattleSubmission(
			{ ...basePayload(), matchPct: 50 },
			baseState(),
			deps
		);
		const elapsed = performance.now() - started;

		expect(result.eventCode).toBe("SYNC_SKIPPED_THRESHOLD");
		expect(result.committed).toBe(false);
		expect(deps.commitFilesToRepo).not.toHaveBeenCalled();
		expect(elapsed).toBeLessThan(SKIP_FAST_PATH_BUDGET_MS);
	});

	it("commits when accepted and improved", async () => {
		const deps = noopDeps();
		const result = await processCssbattleSubmission(
			basePayload(),
			baseState(),
			deps
		);

		expect(result.eventCode).toBe("SYNC_COMMITTED");
		expect(result.committed).toBe(true);
		expect(deps.formatCommitMessage).toHaveBeenCalledWith(640, 225, 99);
		expect(deps.commitFilesToRepo).toHaveBeenCalledTimes(1);
	});

	it("falls back to code length before formatting commits and README labels", async () => {
		const deps = noopDeps();
		const payload = {
			...basePayload(),
			characterCount: null,
			code: "<main></main>",
		};
		await processCssbattleSubmission(
			payload,
			baseState({
				settings: {
					...baseState().settings,
					repositoryReadmeMode: "managed-section",
				},
			}),
			deps
		);

		expect(deps.formatCommitMessage).toHaveBeenCalledWith(
			640,
			"<main></main>".length,
			99
		);
		expect(deps.commitFilesToRepo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.arrayContaining([
				expect.objectContaining({
					path: "README.md",
					content: expect.stringContaining(
						`#42. Carrom</a> (${"<main></main>".length} Characters)`
					),
				}),
			])
		);
	});

	it("skips accepted submissions when preview capture is unavailable", async () => {
		const deps = noopDeps();
		const result = await processCssbattleSubmission(
			{
				...basePayload(),
				resultImageDataUrl: null,
			},
			baseState({
				settings: {
					...baseState().settings,
					threshold: 0,
				},
			}),
			deps
		);

		expect(result.eventCode).toBe("SYNC_SKIPPED_PREVIEW_UNAVAILABLE");
		expect(result.committed).toBe(false);
		expect(deps.buildSubmissionFiles).not.toHaveBeenCalled();
		expect(deps.commitFilesToRepo).not.toHaveBeenCalled();
	});

	it("fetches branch paths for README index before committing", async () => {
		const deps = noopDeps();
		const paths = new Set(["challenges/1/submission.json"]);
		deps.listBranchBlobPaths.mockResolvedValue(paths);

		await processCssbattleSubmission(
			basePayload(),
			baseState({
				settings: {
					...baseState().settings,
					repositoryReadmeMode: "managed-section",
				},
			}),
			deps
		);

		expect(deps.listBranchBlobPaths).toHaveBeenCalledTimes(1);
		expect(deps.commitFilesToRepo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.arrayContaining([
				expect.objectContaining({
					path: "README.md",
					content: expect.stringContaining("#42. Carrom</a> (225 Characters)"),
				}),
			])
		);
	});

	it("uses existing battle metadata when formatting README battle progress", async () => {
		const deps = noopDeps();
		deps.listBranchBlobPaths.mockResolvedValue(
			new Set([
				"Battles/Battle #1/#41. Prior/submission.json",
				"Battles/Battle #1/#42. Carrom/submission.json",
			])
		);
		deps.fetchRepoUtf8File.mockImplementation(
			async (
				_token: string,
				_repoFullName: string,
				_branch: string,
				path: string
			): Promise<string | null> => {
				if (path === "README.md") {
					return null;
				}
				if (path === "Battles/Battle #1/#41. Prior/submission.json") {
					return JSON.stringify({
						battleGroup: "Battle #1",
						battleTotalChallenges: 4,
						battleStatus: "unfinished",
					});
				}
				return null;
			}
		);

		await processCssbattleSubmission(
			basePayload(),
			baseState({
				settings: {
					...baseState().settings,
					repositoryReadmeMode: "managed-section",
				},
			}),
			deps
		);

		expect(deps.commitFilesToRepo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.arrayContaining([
				expect.objectContaining({
					path: "README.md",
					content: expect.stringContaining("Battle #1 (2/4+)"),
				}),
			])
		);
	});

	it("prefers battle manifests over stale submission metadata for README progress", async () => {
		const deps = noopDeps();
		deps.listBranchBlobPaths.mockResolvedValue(
			new Set([
				"Battles/Battle #1/battle.json",
				"Battles/Battle #1/#41. Prior/submission.json",
				"Battles/Battle #1/#42. Carrom/submission.json",
			])
		);
		deps.fetchRepoUtf8File.mockImplementation(
			async (
				_token: string,
				_repoFullName: string,
				_branch: string,
				path: string
			): Promise<string | null> => {
				if (path === "README.md") {
					return null;
				}
				if (path === "Battles/Battle #1/battle.json") {
					return JSON.stringify({
						schemaVersion: 1,
						battleId: "1",
						battleGroup: "Battle #1",
						totalTargets: 4,
						status: "finished",
						fetchedAt: "2026-06-23T12:00:00.000Z",
						lastUpdatedFromTarget: "#42. Carrom",
					});
				}
				if (path === "Battles/Battle #1/#41. Prior/submission.json") {
					return JSON.stringify({
						battleGroup: "Battle #1",
						battleTotalChallenges: 4,
						battleStatus: "unfinished",
					});
				}
				return null;
			}
		);

		await processCssbattleSubmission(
			basePayload(),
			baseState({
				settings: {
					...baseState().settings,
					repositoryReadmeMode: "managed-section",
				},
			}),
			deps
		);

		expect(deps.commitFilesToRepo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.any(String),
			expect.arrayContaining([
				expect.objectContaining({
					path: "README.md",
					content: expect.stringContaining("Battle #1 (2/4)"),
				}),
			])
		);
		const committedFiles = deps.commitFilesToRepo.mock.calls[0]?.[4] as
			| CommitFile[]
			| undefined;
		const readmeFile = committedFiles?.find(
			(file) => file.path === "README.md" && "content" in file
		);
		expect(readmeFile && "content" in readmeFile ? readmeFile.content : "").not.toContain(
			"Battle #1 (2/4+)"
		);
	});

	it("repairs stale unfinished README progress from current finished battle metadata", async () => {
		const deps = noopDeps();
		deps.listBranchBlobPaths.mockResolvedValue(
			new Set([
				"Battles/Battle #1/#41. Prior/submission.json",
				"Battles/Battle #1/#42. Carrom/submission.json",
			])
		);
		deps.fetchRepoUtf8File.mockImplementation(
			async (
				_token: string,
				_repoFullName: string,
				_branch: string,
				path: string
			): Promise<string | null> => {
				if (path === "README.md") {
					return null;
				}
				if (path === "Battles/Battle #1/#41. Prior/submission.json") {
					return JSON.stringify({
						battleGroup: "Battle #1",
						battleTotalChallenges: 12,
						battleStatus: "unfinished",
					});
				}
				return null;
			}
		);

		await processCssbattleSubmission(
			{
				...basePayload(),
				battleId: "1",
				battleTotalChallenges: 12,
				battleStatus: "finished",
			},
			baseState({
				settings: {
					...baseState().settings,
					repositoryReadmeMode: "managed-section",
				},
			}),
			deps
		);

		const committedFiles = deps.commitFilesToRepo.mock.calls[0]?.[4] as
			| CommitFile[]
			| undefined;
		const readmeFile = committedFiles?.find(
			(file) => file.path === "README.md" && "content" in file
		);
		const readme = readmeFile && "content" in readmeFile ? readmeFile.content : "";
		expect(readme).toContain("Battle #1 (2/12)");
		expect(readme).not.toContain("Battle #1 (2/12+)");
	});

	it("completes mocked commit path within budget", async () => {
		const deps = noopDeps();
		const started = performance.now();
		await processCssbattleSubmission(basePayload(), baseState(), deps);
		expect(performance.now() - started).toBeLessThan(8000);
	});
});
