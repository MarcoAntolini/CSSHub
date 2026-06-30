import { popupToBackgroundMessageSchema, type PopupToBackgroundMessage } from "@/shared/contracts";
import { getStoredState, saveStoredState } from "@/storage";
import { toUserSafeError } from "./errors";
import {
	pushEvent,
	registerNotificationHandlers,
	setSetupActionBadgeState,
	showBrowserNotification,
} from "./feedback";
import {
	handleLoginWithPat,
	handleLogoutGithub,
	handlePollGithubDeviceFlow,
	handleStartGithubDeviceFlow,
	handleStartGithubWebFlow,
} from "./handlers/auth";
import {
	handleApplyCssbattleEditorCode,
	handleCaptureElement,
	handleCapturePreview,
	handleExtractCssbattleEditorCode,
} from "./handlers/captureHandlers";
import { handleFormatCssbattleEditorCode } from "./handlers/formatHandlers";
import { handleFetchRemoteImage } from "./handlers/fetchImage";
import {
	handleCreateBranch,
	handleCreateRepo,
	handleListBranches,
	handleListRepos,
} from "./handlers/github";
import {
	handleClearActionBadge,
	handleSubmissionProcessingStarted,
} from "./handlers/badge";
import { handleFetchCssbattleBattleMetadata } from "./handlers/battleMetadata";
import { handleCaptureAttemptFailed } from "./handlers/captureFailure";
import { handleCssbattleSubmission } from "./handlers/submission";
import {
	handleClearRecentEvents,
	handleGetExtensionState,
	handleSaveSettings,
} from "./handlers/settings";
import type { Handler, SendResponse } from "./handlers/types";

registerNotificationHandlers();

const refreshSetupActionBadge = (): void => {
	void getStoredState()
		.then((state) => {
			setSetupActionBadgeState({
				isAuthenticated: state.auth.isAuthenticated,
				hasSelectedRepo: Boolean(state.settings.selectedRepoFullName),
			});
		})
		.catch(() => undefined);
};

refreshSetupActionBadge();
chrome.storage.onChanged.addListener((_changes, areaName) => {
	if (areaName === "local" || areaName === "session") {
		refreshSetupActionBadge();
	}
});

const actionHandlers: {
	[K in PopupToBackgroundMessage["action"]]: Handler<K>;
} = {
	captureElement: handleCaptureElement,
	capturePreview: handleCapturePreview,
	fetchRemoteImage: handleFetchRemoteImage,
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
	formatCssbattleEditorCode: handleFormatCssbattleEditorCode,
	applyCssbattleEditorCode: handleApplyCssbattleEditorCode,
	submissionProcessingStarted: handleSubmissionProcessingStarted,
	clearActionBadge: handleClearActionBadge,
	captureAttemptFailed: handleCaptureAttemptFailed,
	fetchCssbattleBattleMetadata: handleFetchCssbattleBattleMetadata,
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
