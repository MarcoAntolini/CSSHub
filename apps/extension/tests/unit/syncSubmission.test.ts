import { describe, expect, it, vi } from "vitest";
import type { SubmissionPayload } from "../../src/shared/contracts";
import type { StoredState } from "../../src/storage";
import {
	SKIP_FAST_PATH_BUDGET_MS,
	fingerprintSubmission,
	hasPositiveLastScore,
	isDuplicateSubmission,
	processCssbattleSubmission,
} from "../../src/submission/syncSubmission";

const basePayload = (): SubmissionPayload => ({
	challengeId: "42",
	challengeName: "Carrom",
	challengeUrl: "https://cssbattle.dev/play/42",
	submittedAt: new Date().toISOString(),
	score: 640,
	matchPct: 99,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
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
	recentEvents: [],
	lastSubmissionFingerprint: null,
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
	challengeFolderPath: () => "challenges/42",
	formatChallengeTitle: () => "Target 42: Carrom",
	formatCommitMessage: () => "Score: 640 (99.00% match) - CSSHub",
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
		const result = await processCssbattleSubmission(basePayload(), baseState(), deps);

		expect(result.eventCode).toBe("SYNC_COMMITTED");
		expect(result.committed).toBe(true);
		expect(deps.commitFilesToRepo).toHaveBeenCalledTimes(1);
	});

	it("passes existingPaths when README mode updates index", async () => {
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
			expect.any(Array),
			{ existingPaths: paths }
		);
	});

	it("completes mocked commit path within budget", async () => {
		const deps = noopDeps();
		const started = performance.now();
		await processCssbattleSubmission(basePayload(), baseState(), deps);
		expect(performance.now() - started).toBeLessThan(8000);
	});
});
