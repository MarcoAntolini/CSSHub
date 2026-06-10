import {
	submissionIngestionResponseSchema,
	type SubmissionIngestionResponse,
} from "../../shared/contracts";
import {
	commitFilesToRepo,
	fetchRepoUtf8File,
	listBranchBlobPaths,
} from "../../githubClient";
import { getStoredState, saveStoredState } from "../../storage";
import {
	buildSubmissionFiles,
	challengeFolderPath,
	formatChallengeTitle,
	formatCommitMessage,
	readBestSubmissionMetrics,
} from "../../submission/submissionFiles";
import {
	fingerprintSubmission,
	processCssbattleSubmission,
} from "../../submission/syncSubmission";
import type { SyncEventCode } from "../errors";
import {
	pushEvent,
	setActionBadge,
	setLoadingBadge,
	showBrowserNotification,
} from "../feedback";
import { toUserSafeError } from "../errors";
import type { Handler } from "./types";

export const shouldStoreAttemptedSubmission = (
	errorOccurred: boolean,
	shouldAdvanceDuplicateBaseline: boolean
): boolean => errorOccurred || shouldAdvanceDuplicateBaseline;

let submissionQueue: Promise<unknown> = Promise.resolve();

const runSerializedSubmission = <T>(task: () => Promise<T>): Promise<T> => {
	const next = submissionQueue.then(task, task);
	submissionQueue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
};

export const handleCssbattleSubmission: Handler<"cssbattleSubmission"> = async (
	data,
	sendResponse
) => {
	await runSerializedSubmission(async () => {
		setLoadingBadge();

		const state = await getStoredState();
	const threshold = state.settings.threshold;
	const matchPct = data.payload.matchPct ?? -1;
	const hasScoredResult =
		typeof data.payload.score === "number" &&
		Number.isFinite(data.payload.score) &&
		data.payload.score > 0 &&
		typeof data.payload.matchPct === "number" &&
		Number.isFinite(data.payload.matchPct) &&
		data.payload.matchPct > 0;
	const accepted = hasScoredResult && matchPct >= threshold;

	let committed = false;
	let commitUrl: string | null = null;
	let skippedNotImproved = false;
	let errorOccurred = false;
	let reason = "";
	let eventCode: SyncEventCode = "UNEXPECTED_ERROR";
	let recentEvents = state.recentEvents;
	let duplicate = false;
	let shouldAdvanceDuplicateBaseline = false;

	try {
		const result = await processCssbattleSubmission(data.payload, state, {
			readBestSubmissionMetrics,
			buildSubmissionFiles,
			listBranchBlobPaths,
			fetchRepoUtf8File,
			commitFilesToRepo,
			challengeFolderPath,
			formatChallengeTitle,
			formatCommitMessage,
		});
		reason = result.reason;
		eventCode = result.eventCode;
		committed = result.committed;
		commitUrl = result.commitUrl;
		skippedNotImproved = result.skippedNotImproved;
		duplicate = result.duplicate;
		recentEvents = result.recentEvents;
		shouldAdvanceDuplicateBaseline = result.shouldAdvanceDuplicateBaseline;
	} catch (error) {
		errorOccurred = true;
		committed = false;
		commitUrl = null;
		skippedNotImproved = false;
		const safeError = toUserSafeError(error);
		reason = safeError.message;
		eventCode = safeError.code;
		recentEvents = pushEvent(recentEvents, "error", reason, null, eventCode);
		shouldAdvanceDuplicateBaseline = false;
	}

	const responsePayload: SubmissionIngestionResponse =
		submissionIngestionResponseSchema.parse({
			accepted,
			threshold,
			reason,
			code: eventCode,
			committed,
			commitUrl,
		});

	const shouldStoreLastSubmission = shouldStoreAttemptedSubmission(
		errorOccurred,
		shouldAdvanceDuplicateBaseline
	);

	await saveStoredState({
		...state,
		lastSubmission: shouldStoreLastSubmission
			? data.payload
			: state.lastSubmission,
		lastSubmissionAccepted: accepted,
		lastIngestion: responsePayload,
		lastSubmissionFingerprint: shouldAdvanceDuplicateBaseline
			? fingerprintSubmission(data.payload)
			: state.lastSubmissionFingerprint,
		recentEvents,
	});

	if (errorOccurred) {
		setActionBadge("error", "ERR");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"error",
			"CssHub error",
			reason
		);
		sendResponse({ ok: false, error: reason });
		return;
	}

	if (committed) {
		setActionBadge("success", "OK");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"success",
			"CssHub synced",
			reason,
			{ commitUrl }
		);
	} else if (skippedNotImproved) {
		setActionBadge("warn", "BEST");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub kept best result",
			reason
		);
	} else if (accepted) {
		setActionBadge("warn", "WAIT");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub action needed",
			reason
		);
	} else if (duplicate) {
		setActionBadge("warn", "DUP");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub skipped duplicate",
			reason
		);
	} else {
		setActionBadge("warn", "SKIP");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub skipped submission",
			reason
		);
	}

	sendResponse({
		ok: true,
		data: responsePayload,
	});
	});
};
