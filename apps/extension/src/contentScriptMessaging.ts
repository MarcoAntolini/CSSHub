import {
	battleStatusSchema,
	contentScriptTabMessageSchema,
	submissionIngestionResponseSchema,
	type ElementDimensions,
	type SubmissionIngestionResponse,
	type SubmissionPayload,
} from "./shared/contracts";
import {
	getBackgroundErrorMessage,
	isBackgroundResponse,
	parseBackgroundOk,
} from "./shared/messaging";

export const parseContentScriptTabMessage = (
	request: unknown
): { action: "getElementPositionAndDimensions"; selector: string } | null => {
	const parsed = contentScriptTabMessageSchema.safeParse(request);
	return parsed.success ? parsed.data : null;
};

const sendMessage = (message: unknown): Promise<unknown> =>
	chrome.runtime.sendMessage(message);

export const sendCapturePreviewMessage = async (
	dimensions?: ElementDimensions
): Promise<string | null> => {
	const response = await sendMessage({
		action: "capturePreview",
		...(dimensions ? { dimensions } : {}),
	});
	if (!isBackgroundResponse(response) || !response.ok) {
		return null;
	}
	const data = response.data as { croppedDataUrl?: unknown } | undefined;
	return typeof data?.croppedDataUrl === "string" ? data.croppedDataUrl : null;
};

export const sendCssbattleBattleMetadataMessage = async (
	battleId: string
): Promise<{
	battleId: string;
	totalChallenges: number | null;
	status: "finished" | "unfinished";
} | null> => {
	try {
		const response = await sendMessage({
			action: "fetchCssbattleBattleMetadata",
			battleId,
		});
		if (!isBackgroundResponse(response) || !response.ok) {
			return null;
		}
		const data = response.data as Record<string, unknown> | null | undefined;
		const status = battleStatusSchema.safeParse(data?.status);
		if (!data || typeof data.battleId !== "string" || !status.success) {
			return null;
		}
		const totalChallenges = data.totalChallenges;
		return {
			battleId: data.battleId,
			totalChallenges:
				typeof totalChallenges === "number" && Number.isInteger(totalChallenges)
					? totalChallenges
					: null,
			status: status.data,
		};
	} catch (_error) {
		return null;
	}
};

export const sendCssbattleSubmissionMessage = async (
	payload: SubmissionPayload
): Promise<{ ok: true; data: SubmissionIngestionResponse } | { ok: false; error: string }> => {
	try {
		const response = await sendMessage({
			action: "cssbattleSubmission",
			payload,
		});
		if (!isBackgroundResponse(response)) {
			return { ok: false, error: "No response from extension background" };
		}
		if (!response.ok) {
			return {
				ok: false,
				error: getBackgroundErrorMessage(response, "Submission rejected"),
			};
		}
		const data = parseBackgroundOk(
			response,
			submissionIngestionResponseSchema,
			"Invalid submission response"
		);
		return { ok: true, data };
	} catch (error) {
		return {
			ok: false,
			error:
				error instanceof Error ? error.message : "Failed to send submission to background",
		};
	}
};

export const sendBackgroundAction = async (
	action: "submissionProcessingStarted" | "clearActionBadge"
): Promise<void> => {
	try {
		await sendMessage({ action });
	} catch (_error) {
		// Extension context invalidated — badge update is best-effort.
	}
};

export const sendCaptureAttemptFailedMessage = async (payload: {
	issueIds: string[];
	reason: string;
	challengeId?: string;
	challengeName?: string;
	challengeUrl?: string;
}): Promise<boolean> => {
	try {
		const response = await sendMessage({
			action: "captureAttemptFailed",
			...payload,
		});
		return isBackgroundResponse(response) && response.ok;
	} catch (_error) {
		return false;
	}
};
