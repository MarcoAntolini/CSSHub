import { clearActionBadge } from "@/background/feedback";
import { getStoredState, saveStoredState } from "@/storage";
import type { Handler } from "./types";

export const handleSubmissionProcessingStarted: Handler<
	"submissionProcessingStarted"
> = async (_data, sendResponse) => {
	const state = await getStoredState();
	await saveStoredState({
		...state,
		submissionProcessing: true,
	});
	sendResponse({ ok: true });
};

export const handleClearActionBadge: Handler<"clearActionBadge"> = async (
	_data,
	sendResponse
) => {
	const state = await getStoredState();
	await saveStoredState({
		...state,
		submissionProcessing: false,
	});
	clearActionBadge();
	sendResponse({ ok: true });
};
