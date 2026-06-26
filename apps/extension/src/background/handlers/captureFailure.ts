import { getStoredState, saveStoredState } from "@/storage";
import type { CaptureFailure } from "@/shared/contracts";
import {
	pushEvent,
	showBrowserNotification,
} from "@/background/feedback";
import type { Handler } from "./types";

export const handleCaptureAttemptFailed: Handler<"captureAttemptFailed"> = async (
	data,
	sendResponse
) => {
	const state = await getStoredState();
	const captureFailure: CaptureFailure = {
		timestamp: new Date().toISOString(),
		challengeId: data.challengeId,
		challengeName: data.challengeName,
		challengeUrl: data.challengeUrl,
		issueIds: data.issueIds,
		reason: data.reason,
		code: "CAPTURE_FAILED",
	};

	await saveStoredState({
		...state,
		submissionProcessing: false,
		lastCaptureFailure: captureFailure,
		recentEvents: pushEvent(
			state.recentEvents,
			"warn",
			data.reason,
			null,
			"CAPTURE_FAILED"
		),
	});

	showBrowserNotification(
		state.settings.systemNotificationsEnabled,
		"warn",
		"CssHub capture failed",
		data.reason
	);

	sendResponse({ ok: true });
};
