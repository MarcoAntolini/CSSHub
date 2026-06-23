import { describe, expect, it, vi } from "vitest";
import type { SubmissionPayload } from "@/shared/contracts";
import type { StoredState } from "@/storage";
import {
	buildIngestionStoragePatch,
	ingestCssbattleSubmission,
	resolveSubmissionFeedback,
	shouldStoreAttemptedSubmission,
} from "@/submission/ingestSubmission";
import type { SyncSubmissionResult } from "@/submission/syncSubmission";

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
	...overrides,
});

const syncResult = (overrides: Partial<SyncSubmissionResult> = {}): SyncSubmissionResult => ({
	accepted: true,
	threshold: 95,
	reason: "Submission committed to GitHub",
	eventCode: "SYNC_COMMITTED",
	committed: true,
	commitUrl: "https://github.com/qa-user/csshub-test/commit/abc",
	skippedNotImproved: false,
	duplicate: false,
	errorOccurred: false,
	recentEvents: [],
	shouldAdvanceDuplicateBaseline: true,
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
	formatCommitMessage: () => "Score: 640, Characters: 225 (99.00% match) - CSSHub",
	mapError: (error: unknown) => ({
		message: error instanceof Error ? error.message : "Unexpected background failure",
		code: "UNEXPECTED_ERROR" as const,
	}),
});

describe("shouldStoreAttemptedSubmission", () => {
	it("stores failed attempts for popup status without advancing duplicate baseline", () => {
		expect(shouldStoreAttemptedSubmission(true, false)).toBe(true);
	});

	it("stores successful non-duplicate attempts", () => {
		expect(shouldStoreAttemptedSubmission(false, true)).toBe(true);
	});

	it("keeps the previous display for duplicate submissions", () => {
		expect(shouldStoreAttemptedSubmission(false, false)).toBe(false);
	});
});

describe("resolveSubmissionFeedback", () => {
	it("maps committed runs to success feedback", () => {
		expect(resolveSubmissionFeedback(syncResult())).toEqual({
			level: "success",
			badgeText: "OK",
			notificationTitle: "CssHub synced",
			commitUrl: "https://github.com/qa-user/csshub-test/commit/abc",
		});
	});

	it("maps not-improved runs to BEST feedback", () => {
		expect(
			resolveSubmissionFeedback(
				syncResult({
					committed: false,
					commitUrl: null,
					skippedNotImproved: true,
					eventCode: "SYNC_SKIPPED_NOT_IMPROVED",
				})
			)
		).toEqual({
			level: "warn",
			badgeText: "BEST",
			notificationTitle: "CssHub kept best result",
		});
	});

	it("maps duplicate runs to DUP feedback", () => {
		expect(
			resolveSubmissionFeedback(
				syncResult({
					accepted: false,
					committed: false,
					duplicate: true,
					shouldAdvanceDuplicateBaseline: false,
					eventCode: "SYNC_SKIPPED_DUPLICATE",
				})
			)
		).toEqual({
			level: "warn",
			badgeText: "DUP",
			notificationTitle: "CssHub skipped duplicate",
		});
	});
});

describe("buildIngestionStoragePatch", () => {
	it("advances duplicate baseline for non-duplicate runs", () => {
		const payload = basePayload();
		const state = baseState();
		const patch = buildIngestionStoragePatch(payload, state, syncResult());

		expect(patch.lastSubmission).toEqual(payload);
		expect(patch.lastSubmissionFingerprint).toBeTruthy();
		expect(patch.lastSubmissionAccepted).toBe(true);
	});

	it("stores battle metadata from payload in the cache", () => {
		const payload = {
			...basePayload(),
			battleId: "1",
			battleTotalChallenges: 12,
			battleStatus: "finished" as const,
		};
		const patch = buildIngestionStoragePatch(payload, baseState(), syncResult());

		expect(patch.battleMetadataCache["1"]).toMatchObject({
			battleId: "1",
			totalChallenges: 12,
			status: "finished",
		});
	});

	it("preserves prior submission state for duplicates", () => {
		const prior = basePayload();
		const state = baseState({
			lastSubmission: prior,
			lastSubmissionFingerprint: "prior-fingerprint",
		});
		const patch = buildIngestionStoragePatch(
			basePayload(),
			state,
			syncResult({
				duplicate: true,
				shouldAdvanceDuplicateBaseline: false,
				committed: false,
				eventCode: "SYNC_SKIPPED_DUPLICATE",
			})
		);

		expect(patch.lastSubmission).toBe(prior);
		expect(patch.lastSubmissionFingerprint).toBe("prior-fingerprint");
	});
});

describe("ingestCssbattleSubmission", () => {
	it("returns committed outcome through one interface", async () => {
		const outcome = await ingestCssbattleSubmission(
			basePayload(),
			baseState(),
			noopDeps()
		);

		expect(outcome.errorOccurred).toBe(false);
		expect(outcome.responsePayload.committed).toBe(true);
		expect(outcome.feedback.badgeText).toBe("OK");
		expect(outcome.storagePatch.lastSubmission).toBeTruthy();
	});

	it("maps thrown sync failures to error outcome", async () => {
		const payload = basePayload();
		const deps = noopDeps();
		deps.commitFilesToRepo.mockRejectedValue(new Error("GitHub request failed (409)"));

		const outcome = await ingestCssbattleSubmission(payload, baseState(), deps);

		expect(outcome.errorOccurred).toBe(true);
		expect(outcome.feedback.level).toBe("error");
		expect(outcome.responsePayload.committed).toBe(false);
		expect(outcome.storagePatch.recentEvents[0]?.level).toBe("error");
		expect(outcome.storagePatch.lastSubmission).toEqual(payload);
	});
});
