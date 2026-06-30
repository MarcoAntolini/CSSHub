import {
	commitFilesToRepo,
	fetchRepoUtf8File,
	listBranchBlobPaths,
} from "@/githubClient";
import { getStoredState, saveStoredState } from "@/storage";
import {
	buildSubmissionFiles,
	challengeFolderPath,
	formatChallengeTitle,
	formatCommitMessage,
	readBestSubmissionMetrics,
} from "@/submission/submissionFiles";
import { ingestCssbattleSubmission } from "@/submission/ingestSubmission";
import { toUserSafeError } from "@/background/errors";
import {
	showBrowserNotification,
} from "@/background/feedback";
import type { Handler } from "./types";

let submissionQueue: Promise<unknown> = Promise.resolve();

const runSerializedSubmission = <T>(task: () => Promise<T>): Promise<T> => {
	const next = submissionQueue.then(task, task);
	submissionQueue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
};

const defaultIngestionDeps = {
	readBestSubmissionMetrics,
	buildSubmissionFiles: (payload: Parameters<typeof buildSubmissionFiles>[0], settings: Parameters<typeof buildSubmissionFiles>[1]) =>
		buildSubmissionFiles(payload, settings),
	listBranchBlobPaths,
	fetchRepoUtf8File,
	commitFilesToRepo,
	challengeFolderPath,
	formatChallengeTitle,
	formatCommitMessage,
	mapError: toUserSafeError,
};

export const handleCssbattleSubmission: Handler<"cssbattleSubmission"> = async (
	data,
	sendResponse
) => {
	await runSerializedSubmission(async () => {
		const state = await getStoredState();
		await saveStoredState({
			...state,
			submissionProcessing: true,
		});
		const outcome = await ingestCssbattleSubmission(data.payload, state, defaultIngestionDeps);

		await saveStoredState({
			...state,
			...outcome.storagePatch,
			submissionProcessing: false,
		});

		const { feedback } = outcome;
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			feedback.level,
			feedback.notificationTitle,
			outcome.responsePayload.reason,
			feedback.commitUrl !== undefined ? { commitUrl: feedback.commitUrl } : undefined
		);

		if (outcome.errorOccurred) {
			sendResponse({ ok: false, error: outcome.errorMessage ?? outcome.responsePayload.reason });
			return;
		}

		sendResponse({
			ok: true,
			data: outcome.responsePayload,
		});
	});
};
