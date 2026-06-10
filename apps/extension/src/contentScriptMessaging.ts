import {
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
		if (isBackgroundResponse(response) && !response.ok) {
			console.warn("[CssHub] Background preview capture failed:", response.error);
		}
		return null;
	}
	const data = response.data as { croppedDataUrl?: unknown } | undefined;
	return typeof data?.croppedDataUrl === "string" ? data.croppedDataUrl : null;
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
