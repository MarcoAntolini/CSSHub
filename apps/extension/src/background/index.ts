import { popupToBackgroundMessageSchema, type PopupToBackgroundMessage } from "../shared/contracts";
import { getStoredState, saveStoredState } from "../storage";
import { toUserSafeError } from "./errors";
import { pushEvent, setActionBadge, showBrowserNotification } from "./feedback";
import {
	handleLoginWithPat,
	handleLogoutGithub,
	handlePollGithubDeviceFlow,
	handleStartGithubDeviceFlow,
	handleStartGithubWebFlow,
} from "./handlers/auth";
import {
	handleCaptureElement,
	handleExtractCssbattleEditorCode,
} from "./handlers/captureHandlers";
import {
	handleCreateBranch,
	handleCreateRepo,
	handleListBranches,
	handleListRepos,
} from "./handlers/github";
import { handleCssbattleSubmission } from "./handlers/submission";
import {
	handleClearRecentEvents,
	handleGetExtensionState,
	handleSaveSettings,
} from "./handlers/settings";
import type { Handler, SendResponse } from "./handlers/types";

const actionHandlers: {
	[K in PopupToBackgroundMessage["action"]]: Handler<K>;
} = {
	captureElement: handleCaptureElement,
	getExtensionState: handleGetExtensionState,
	saveSettings: handleSaveSettings,
	startGithubDeviceFlow: handleStartGithubDeviceFlow,
	pollGithubDeviceFlow: handlePollGithubDeviceFlow,
	startGithubWebFlow: handleStartGithubWebFlow,
	loginWithPat: handleLoginWithPat,
	logoutGithub: handleLogoutGithub,
	clearRecentEvents: handleClearRecentEvents,
	listRepos: handleListRepos,
	listBranches: handleListBranches,
	createRepo: handleCreateRepo,
	createBranch: handleCreateBranch,
	extractCssbattleEditorCode: handleExtractCssbattleEditorCode,
	cssbattleSubmission: handleCssbattleSubmission,
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	const parsed = popupToBackgroundMessageSchema.safeParse(request);
	if (!parsed.success) {
		sendResponse({
			ok: false,
			error: "Invalid message payload",
		});
		return;
	}

	const data = parsed.data;
	const handler = actionHandlers[data.action] as (
		payload: typeof data,
		reply: SendResponse,
		sender: chrome.runtime.MessageSender
	) => Promise<void>;

	void handler(data, sendResponse, _sender).catch((error: unknown) => {
		const safeError = toUserSafeError(error);
		setActionBadge("error", "ERR");
		void getStoredState()
			.then((state) => {
				showBrowserNotification(
					state.settings.systemNotificationsEnabled,
					"error",
					"CssHub error",
					safeError.message
				);
				return saveStoredState({
					...state,
					recentEvents: pushEvent(
						state.recentEvents,
						"error",
						safeError.message,
						null,
						safeError.code
					),
				});
			})
			.catch(() => undefined);
		sendResponse({
			ok: false,
			error: safeError.message,
		});
	});

	return true;
});
