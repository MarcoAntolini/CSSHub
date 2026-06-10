import { clearActionBadge, setLoadingBadge } from "../feedback";
import type { Handler } from "./types";

export const handleSubmissionProcessingStarted: Handler<
	"submissionProcessingStarted"
> = async (_data, sendResponse) => {
	setLoadingBadge();
	sendResponse({ ok: true });
};

export const handleClearActionBadge: Handler<"clearActionBadge"> = async (
	_data,
	sendResponse
) => {
	clearActionBadge();
	sendResponse({ ok: true });
};
