import type { SubmissionPayload, SyncEvent, SyncIngestionEventCode } from "@/shared/contracts";
import {
	buildRootReadmeContent,
	extractBattleGroupFromFolder,
	type BattleReadmeMetadata,
} from "@/rootReadme";
import type { CommitFile, CommitResult, SavedSubmissionMetrics } from "@/githubClient";
import type { StoredState } from "@/storage";
import { normalizeSubmissionCharacterCount } from "./characterCount";
import { challengeIdentityKey, folderFromSubmissionJsonPath } from "./challengeModel";
import {
	battleManifestGroupFromPath,
	parseBattleManifest,
	type BattleManifest,
} from "./battleManifest";
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

const parseBattleReadmeMetadata = (content: string | null): {
	group: string;
	metadata: BattleReadmeMetadata;
} | null => {
	if (!content) {
		return null;
	}
	try {
		const parsed = JSON.parse(content) as Record<string, unknown>;
		const group = parsed.battleGroup;
		const totalChallenges = parsed.battleTotalChallenges;
		const status = parsed.battleStatus;
		if (
			typeof group !== "string" ||
			typeof totalChallenges !== "number" ||
			!Number.isInteger(totalChallenges) ||
			totalChallenges <= 0 ||
			(status !== "finished" && status !== "unfinished")
		) {
			return null;
		}
		return {
			group,
			metadata: {
				totalChallenges,
				status,
			},
		};
	} catch (_error) {
		return null;
	}
};

const battleReadmeMetadataFromManifest = (
	manifest: BattleManifest
): { group: string; metadata: BattleReadmeMetadata } => ({
	group: manifest.battleGroup,
	metadata: {
		totalChallenges: manifest.totalTargets,
		status: manifest.status,
	},
});

const mergeBattleReadmeMetadata = (
	current: BattleReadmeMetadata | undefined,
	next: BattleReadmeMetadata
): BattleReadmeMetadata => {
	if (!current) {
		return next;
	}
	if (current.status === "finished") {
		return current;
	}
	if (next.status === "finished") {
		return next;
	}
	return next.totalChallenges >= current.totalChallenges ? next : current;
};

const collectCurrentBattleReadmeMetadata = (
	payload: SubmissionPayload
): { group: string; metadata: BattleReadmeMetadata } | null => {
	if (
		payload.challengeMode !== "battle" ||
		!payload.battleGroup ||
		typeof payload.battleTotalChallenges !== "number" ||
		!Number.isInteger(payload.battleTotalChallenges) ||
		payload.battleTotalChallenges <= 0 ||
		(payload.battleStatus !== "finished" && payload.battleStatus !== "unfinished")
	) {
		return null;
	}
	return {
		group: payload.battleGroup,
		metadata: {
			totalChallenges: payload.battleTotalChallenges,
			status: payload.battleStatus,
		},
	};
};

const collectBattleMetadataPathsByGroup = (
	paths: Iterable<string>
): Map<string, string[]> => {
	const byGroup = new Map<string, string[]>();
	for (const path of paths) {
		const parsed = folderFromSubmissionJsonPath(path);
		if (parsed?.kind !== "battle") {
			continue;
		}
		const group = extractBattleGroupFromFolder(parsed.folder);
		if (group) {
			const groupPaths = byGroup.get(group) ?? [];
			groupPaths.push(path);
			byGroup.set(group, groupPaths);
		}
	}
	return byGroup;
};

const collectBattleManifestPathsByGroup = (
	paths: Iterable<string>
): Map<string, string> => {
	const byGroup = new Map<string, string>();
	for (const path of paths) {
		const group = battleManifestGroupFromPath(path);
		if (group) {
			byGroup.set(group, path);
		}
	}
	return byGroup;
};

const fetchBattleReadmeMetadataByGroup = async (
	token: string,
	repoFullName: string,
	branch: string,
	paths: Iterable<string>,
	fetchRepoUtf8File: SyncSubmissionDeps["fetchRepoUtf8File"]
): Promise<Map<string, BattleReadmeMetadata>> => {
	const metadata = new Map<string, BattleReadmeMetadata>();
	const pathList = [...paths];
	const manifestPathsByGroup = collectBattleManifestPathsByGroup(pathList);
	await Promise.all(
		[...manifestPathsByGroup.values()].map(async (path) => {
			const manifest = parseBattleManifest(
				await fetchRepoUtf8File(token, repoFullName, branch, path)
			);
			if (manifest) {
				const parsed = battleReadmeMetadataFromManifest(manifest);
				metadata.set(
					parsed.group,
					mergeBattleReadmeMetadata(metadata.get(parsed.group), parsed.metadata)
				);
			}
		})
	);
	const submissionPathsByGroup = collectBattleMetadataPathsByGroup(pathList);
	await Promise.all(
		[...submissionPathsByGroup.entries()].map(async ([group, groupPaths]) => {
			if (metadata.has(group)) {
				return;
			}
			const parsedItems = await Promise.all(
				groupPaths.map(async (path) =>
					parseBattleReadmeMetadata(
						await fetchRepoUtf8File(token, repoFullName, branch, path)
					)
				)
			);
			for (const parsed of parsedItems) {
				if (parsed) {
					metadata.set(
						parsed.group,
						mergeBattleReadmeMetadata(metadata.get(parsed.group), parsed.metadata)
					);
				}
			}
		})
	);
	return metadata;
};

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
						const battleMetadataByGroup = await fetchBattleReadmeMetadataByGroup(
							state.githubToken,
							repoFullName,
							branch,
							existingPaths,
							deps.fetchRepoUtf8File
						);
						const currentBattleMetadata = collectCurrentBattleReadmeMetadata(payload);
						if (currentBattleMetadata) {
							battleMetadataByGroup.set(
								currentBattleMetadata.group,
								mergeBattleReadmeMetadata(
									battleMetadataByGroup.get(currentBattleMetadata.group),
									currentBattleMetadata.metadata
								)
							);
						}
						const rootReadme = buildRootReadmeContent({
							mode: readmeMode,
							existingReadme,
							existingBlobPaths: existingPaths,
							challengeFolder: deps.challengeFolderPath(payload),
							challengeTitle: formatChallengeTitleWithCharacterCount(
								deps.formatChallengeTitle(payload),
								payload.characterCount
							),
							battleMetadataByGroup,
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
