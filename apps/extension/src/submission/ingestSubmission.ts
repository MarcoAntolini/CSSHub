import {
	submissionIngestionResponseSchema,
	type BackgroundEventCode,
	type SubmissionIngestionResponse,
	type SubmissionPayload,
} from "@/shared/contracts";
import type { StoredState } from "@/storage";
import type { CssbattleBattleMetadataCache } from "@/cssbattleBattleMetadata";
import { pushSyncEvent } from "./recentEvents";
import {
	fingerprintSubmission,
	hasPositiveLastScore,
	processCssbattleSubmission,
	type SyncSubmissionDeps,
	type SyncSubmissionResult,
} from "./syncSubmission";
import { normalizeSubmissionCharacterCount } from "./characterCount";

export type SubmissionFeedbackLevel = "success" | "warn" | "error";

export type SubmissionFeedback = {
	level: SubmissionFeedbackLevel;
	badgeText: string;
	notificationTitle: string;
	commitUrl?: string | null;
};

export type IngestSubmissionDeps = SyncSubmissionDeps & {
	mapError: (error: unknown) => { message: string; code: BackgroundEventCode };
};

export type IngestSubmissionOutcome = {
	errorOccurred: boolean;
	responsePayload: SubmissionIngestionResponse;
	storagePatch: Pick<
		StoredState,
		| "lastSubmission"
		| "lastSubmissionAccepted"
		| "lastIngestion"
		| "lastSubmissionFingerprint"
		| "recentEvents"
		| "battleMetadataCache"
		| "lastCaptureFailure"
	>;
	feedback: SubmissionFeedback;
	errorMessage: string | null;
};

export const shouldStoreAttemptedSubmission = (
	errorOccurred: boolean,
	shouldAdvanceDuplicateBaseline: boolean
): boolean => errorOccurred || shouldAdvanceDuplicateBaseline;

const acceptedByThreshold = (
	payload: SubmissionPayload,
	threshold: number
): boolean => hasPositiveLastScore(payload) && (payload.matchPct ?? -1) >= threshold;

const toIngestionResponse = (
	result: Pick<
		SyncSubmissionResult,
		"accepted" | "threshold" | "reason" | "eventCode" | "committed" | "commitUrl"
	>
): SubmissionIngestionResponse =>
	submissionIngestionResponseSchema.parse({
		accepted: result.accepted,
		threshold: result.threshold,
		reason: result.reason,
		code: result.eventCode,
		committed: result.committed,
		commitUrl: result.commitUrl,
	});

const updateBattleMetadataCacheFromPayload = (
	payload: SubmissionPayload,
	cache: CssbattleBattleMetadataCache
): CssbattleBattleMetadataCache => {
	if (
		payload.challengeMode !== "battle" ||
		!payload.battleId ||
		typeof payload.battleTotalChallenges !== "number" ||
		!Number.isInteger(payload.battleTotalChallenges) ||
		payload.battleTotalChallenges <= 0 ||
		(payload.battleStatus !== "finished" && payload.battleStatus !== "unfinished")
	) {
		return cache;
	}
	const cached = cache[payload.battleId];
	if (cached?.status === "finished" && cached.totalChallenges !== null) {
		return cache;
	}
	return {
		...cache,
		[payload.battleId]: {
			battleId: payload.battleId,
			totalChallenges: payload.battleTotalChallenges,
			status: payload.battleStatus,
			fetchedAt: new Date().toISOString(),
		},
	};
};

export const buildIngestionStoragePatch = (
	payload: SubmissionPayload,
	state: StoredState,
	result: SyncSubmissionResult
): IngestSubmissionOutcome["storagePatch"] => {
	const responsePayload = toIngestionResponse(result);
	const shouldStoreLastSubmission = shouldStoreAttemptedSubmission(
		result.errorOccurred,
		result.shouldAdvanceDuplicateBaseline
	);

	return {
		lastSubmission: shouldStoreLastSubmission ? payload : state.lastSubmission,
		lastSubmissionAccepted: result.accepted,
		lastIngestion: responsePayload,
		lastSubmissionFingerprint: result.shouldAdvanceDuplicateBaseline
			? fingerprintSubmission(payload)
			: state.lastSubmissionFingerprint,
		recentEvents: result.recentEvents,
		battleMetadataCache: updateBattleMetadataCacheFromPayload(
			payload,
			state.battleMetadataCache
		),
		lastCaptureFailure: null,
	};
};

export const resolveSubmissionFeedback = (
	result: SyncSubmissionResult
): SubmissionFeedback => {
	if (result.errorOccurred) {
		return {
			level: "error",
			badgeText: "ERR",
			notificationTitle: "CssHub error",
		};
	}
	if (result.committed) {
		return {
			level: "success",
			badgeText: "OK",
			notificationTitle: "CssHub synced",
			commitUrl: result.commitUrl,
		};
	}
	if (result.skippedNotImproved) {
		return {
			level: "warn",
			badgeText: "BEST",
			notificationTitle: "CssHub kept best result",
		};
	}
	if (result.accepted) {
		return {
			level: "warn",
			badgeText: "WAIT",
			notificationTitle: "CssHub action needed",
		};
	}
	if (result.duplicate) {
		return {
			level: "warn",
			badgeText: "DUP",
			notificationTitle: "CssHub skipped duplicate",
		};
	}
	return {
		level: "warn",
		badgeText: "SKIP",
		notificationTitle: "CssHub skipped submission",
	};
};

export const ingestCssbattleSubmission = async (
	payload: SubmissionPayload,
	state: StoredState,
	deps: IngestSubmissionDeps
): Promise<IngestSubmissionOutcome> => {
	const normalizedPayload = normalizeSubmissionCharacterCount(payload);
	try {
		const result = await processCssbattleSubmission(normalizedPayload, state, deps);
		const responsePayload = toIngestionResponse(result);
		return {
			errorOccurred: false,
			responsePayload,
			storagePatch: buildIngestionStoragePatch(normalizedPayload, state, result),
			feedback: resolveSubmissionFeedback(result),
			errorMessage: null,
		};
	} catch (error) {
		const safeError = deps.mapError(error);
		const threshold = state.settings.threshold;
		const accepted = acceptedByThreshold(normalizedPayload, threshold);
		const recentEvents = pushSyncEvent(
			state.recentEvents,
			"error",
			safeError.message,
			null,
			safeError.code
		);
		const responsePayload = submissionIngestionResponseSchema.parse({
			accepted,
			threshold,
			reason: safeError.message,
			code: safeError.code,
			committed: false,
			commitUrl: null,
		});

		return {
			errorOccurred: true,
			responsePayload,
			storagePatch: {
				lastSubmission: shouldStoreAttemptedSubmission(true, false)
					? normalizedPayload
					: state.lastSubmission,
				lastSubmissionAccepted: accepted,
				lastIngestion: responsePayload,
				lastSubmissionFingerprint: state.lastSubmissionFingerprint,
				recentEvents,
				battleMetadataCache: updateBattleMetadataCacheFromPayload(
					normalizedPayload,
					state.battleMetadataCache
				),
				lastCaptureFailure: null,
			},
			feedback: {
				level: "error",
				badgeText: "ERR",
				notificationTitle: "CssHub error",
			},
			errorMessage: safeError.message,
		};
	}
};
