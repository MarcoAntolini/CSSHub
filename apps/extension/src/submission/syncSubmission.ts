import type { SubmissionPayload, SyncEvent, SyncIngestionEventCode } from "@/shared/contracts";
import { buildRootReadmeContent } from "@/rootReadme";
import type { CommitFile, CommitResult, SavedSubmissionMetrics } from "@/githubClient";
import type { StoredState } from "@/storage";
import { normalizeSubmissionCharacterCount } from "./characterCount";
import { challengeIdentityKey } from "./challengeModel";
import { pushSyncEvent } from "./recentEvents";

export const DUPLICATE_WINDOW_MS = 45 * 1000;
const DUPLICATE_WINDOW_SECONDS = Math.floor(DUPLICATE_WINDOW_MS / 1000);
const MAX_REASONABLE_SCORE = 100_000;
export const SKIP_FAST_PATH_BUDGET_MS = 500;

export type SyncEventCode = SyncIngestionEventCode;

export type SyncSubmissionDeps = {
	readBestSubmissionMetrics: (
		token: string,
		repoFullName: string,
		branch: string,
		payload: SubmissionPayload
	) => Promise<SavedSubmissionMetrics | null>;
	buildSubmissionFiles: (payload: SubmissionPayload) => Promise<CommitFile[]>;
	listBranchBlobPaths: (
		token: string,
		repoFullName: string,
		branch: string
	) => Promise<Set<string>>;
	fetchRepoUtf8File: (
		token: string,
		repoFullName: string,
		branch: string,
		path: string
	) => Promise<string | null>;
	commitFilesToRepo: (
		token: string,
		repoFullName: string,
		branch: string,
		message: string,
		files: CommitFile[]
	) => Promise<CommitResult>;
	challengeFolderPath: (payload: SubmissionPayload) => string;
	formatChallengeTitle: (payload: SubmissionPayload) => string;
	formatCommitMessage: (
		score: number | null,
		characterCount: number,
		matchPct: number | null
	) => string;
};

export type SyncSubmissionResult = {
	accepted: boolean;
	threshold: number;
	reason: string;
	eventCode: SyncEventCode;
	committed: boolean;
	commitUrl: string | null;
	skippedNotImproved: boolean;
	duplicate: boolean;
	errorOccurred: boolean;
	recentEvents: SyncEvent[];
	shouldAdvanceDuplicateBaseline: boolean;
};

export const fingerprintSubmission = (payload: SubmissionPayload): string => {
	const compact = JSON.stringify({
		identity: challengeIdentityKey(payload),
		challengeMode: payload.challengeMode,
		score: payload.score,
		matchPct: payload.matchPct,
		characterCount: payload.characterCount,
		code: payload.code,
	});
	let hash = 0;
	for (let index = 0; index < compact.length; index += 1) {
		hash = (hash << 5) - hash + compact.charCodeAt(index);
		hash |= 0;
	}
	return String(hash);
};

export const isDuplicateSubmission = (
	payload: SubmissionPayload,
	lastSubmission: SubmissionPayload | null,
	lastFingerprint: string | null
): boolean => {
	if (!lastSubmission || !lastFingerprint) {
		return false;
	}
	const currentFingerprint = fingerprintSubmission(payload);
	if (currentFingerprint !== lastFingerprint) {
		return false;
	}
	const now = Date.parse(payload.submittedAt);
	const before = Date.parse(lastSubmission.submittedAt);
	if (Number.isNaN(now) || Number.isNaN(before)) {
		return false;
	}
	return now - before <= DUPLICATE_WINDOW_MS;
};

const duplicateReasonMessage = (): string =>
	`Duplicate submission skipped: same challenge, code, score, match, and character count within ${DUPLICATE_WINDOW_SECONDS}s window.`;

export const isImprovedSubmission = (
	current: SavedSubmissionMetrics,
	previous: SavedSubmissionMetrics
): boolean => {
	if (current.matchPct > previous.matchPct) {
		return true;
	}
	if (current.matchPct < previous.matchPct) {
		return false;
	}
	return current.score > previous.score;
};

const formatSubmissionLine = (m: SavedSubmissionMetrics): string =>
	`${m.matchPct.toFixed(2)}% match · ${m.score} score`;

const formatChallengeTitleWithCharacterCount = (
	title: string,
	characterCount: number | null
): string => (characterCount === null ? title : `${title} (${characterCount} Characters)`);

const notImprovedReasonMessage = (
	current: SavedSubmissionMetrics,
	previous: SavedSubmissionMetrics
): string => {
	const best = formatSubmissionLine(previous);
	const now = formatSubmissionLine(current);
	if (current.matchPct === previous.matchPct && current.score === previous.score) {
		return `Repository left unchanged: this run matches your best on this branch (${best}). Only a strictly better match % or score triggers a new commit.`;
	}
	return `Repository left unchanged: best on this branch is ${best}. This run was ${now}, which is not an improvement.`;
};

export const hasPositiveLastScore = (payload: SubmissionPayload): boolean =>
	typeof payload.score === "number" &&
	Number.isFinite(payload.score) &&
	payload.score > 0 &&
	payload.score <= MAX_REASONABLE_SCORE &&
	typeof payload.matchPct === "number" &&
	Number.isFinite(payload.matchPct) &&
	payload.matchPct > 0;

export const processCssbattleSubmission = async (
	rawPayload: SubmissionPayload,
	state: StoredState,
	deps: SyncSubmissionDeps
): Promise<SyncSubmissionResult> => {
	const payload = normalizeSubmissionCharacterCount(rawPayload);
	const threshold = state.settings.threshold;
	const matchPct = payload.matchPct ?? -1;
	const hasScoredResult = hasPositiveLastScore(payload);
	const accepted = hasScoredResult && matchPct >= threshold;
	const duplicate = isDuplicateSubmission(
		payload,
		state.lastSubmission,
		state.lastSubmissionFingerprint
	);
	let committed = false;
	let commitUrl: string | null = null;
	let skippedNotImproved = false;
	let reason = !hasScoredResult
		? "Submission skipped because Last score is zero, unavailable, or invalid"
		: accepted
			? "Submission accepted by threshold"
			: "Submission below threshold";
	let eventCode: SyncEventCode = hasScoredResult
		? accepted
			? "SYNC_COMMITTED"
			: "SYNC_SKIPPED_THRESHOLD"
		: "SYNC_SKIPPED_INVALID_SCORE";
	let recentEvents = state.recentEvents;

	if (duplicate) {
		reason = duplicateReasonMessage();
		eventCode = "SYNC_SKIPPED_DUPLICATE";
		recentEvents = pushSyncEvent(recentEvents, "warn", reason, null, eventCode);
	} else if (accepted) {
		if (!state.githubToken) {
			reason = "Submission accepted but GitHub is not authenticated";
			eventCode = "SYNC_AUTH_REQUIRED";
			recentEvents = pushSyncEvent(recentEvents, "warn", reason, null, eventCode);
		} else if (!state.settings.selectedRepoFullName) {
			reason = "Submission accepted but no repository selected";
			eventCode = "SYNC_REPO_REQUIRED";
			recentEvents = pushSyncEvent(recentEvents, "warn", reason, null, eventCode);
		} else if (!payload.resultImageDataUrl) {
			reason =
				"Submission accepted but preview capture was unavailable. Retry from the CSSBattle tab so CssHub can include user.png.";
			eventCode = "SYNC_SKIPPED_PREVIEW_UNAVAILABLE";
			recentEvents = pushSyncEvent(recentEvents, "warn", reason, null, eventCode);
		} else {
			const branch = state.settings.selectedBranch?.trim() || "main";
			const repoFullName = state.settings.selectedRepoFullName;
			const currentMetrics: SavedSubmissionMetrics = {
				score: payload.score ?? 0,
				matchPct: payload.matchPct ?? 0,
			};
			const previousMetrics = await deps.readBestSubmissionMetrics(
				state.githubToken,
				repoFullName,
				branch,
				payload
			);
			if (previousMetrics && !isImprovedSubmission(currentMetrics, previousMetrics)) {
				skippedNotImproved = true;
				reason = notImprovedReasonMessage(currentMetrics, previousMetrics);
				eventCode = "SYNC_SKIPPED_NOT_IMPROVED";
				recentEvents = pushSyncEvent(recentEvents, "warn", reason, null, eventCode);
			} else {
				const files = await deps.buildSubmissionFiles(payload);
				const readmeMode = state.settings.repositoryReadmeMode ?? "managed-section";
				if (readmeMode !== "off") {
					try {
						const [existingPaths, existingReadme] = await Promise.all([
							deps.listBranchBlobPaths(state.githubToken, repoFullName, branch),
							deps.fetchRepoUtf8File(
								state.githubToken,
								repoFullName,
								branch,
								"README.md"
							),
						]);
						const rootReadme = buildRootReadmeContent({
							mode: readmeMode,
							existingReadme,
							existingBlobPaths: existingPaths,
							challengeFolder: deps.challengeFolderPath(payload),
							challengeTitle: formatChallengeTitleWithCharacterCount(
								deps.formatChallengeTitle(payload),
								payload.characterCount
							),
						});
						if (rootReadme !== null) {
							files.push({
								path: "README.md",
								content: rootReadme,
								encoding: "utf-8",
							});
						}
					} catch (readmeError) {
						console.warn("CssHub: root README update skipped", readmeError);
					}
				}
				const commitMessage = deps.formatCommitMessage(
					payload.score,
					payload.characterCount,
					payload.matchPct
				);
				const commitResult = await deps.commitFilesToRepo(
					state.githubToken,
					repoFullName,
					branch,
					commitMessage,
					files
				);
				committed = true;
				commitUrl = commitResult.commitUrl;
				reason = "Submission committed to GitHub";
				eventCode = "SYNC_COMMITTED";
				recentEvents = pushSyncEvent(recentEvents, "info", reason, commitUrl, eventCode);
			}
		}
	} else {
		recentEvents = pushSyncEvent(recentEvents, "info", reason, null, eventCode);
	}

	const shouldAdvanceDuplicateBaseline = !duplicate;

	return {
		accepted,
		threshold,
		reason,
		eventCode,
		committed,
		commitUrl,
		skippedNotImproved,
		duplicate,
		errorOccurred: false,
		recentEvents,
		shouldAdvanceDuplicateBaseline,
	};
};
