import { extensionStateResponseSchema, type Repo } from "../../shared/contracts";
import { listUserRepos } from "../../githubClient";
import { clearRecentEvents, getStoredState, saveStoredState } from "../../storage";
import type { Handler } from "./types";

export const handleGetExtensionState: Handler<"getExtensionState"> = async (
	_data,
	sendResponse
) => {
	const state = await getStoredState();
	let repos: Repo[] = [];
	if (state.githubToken) {
		try {
			repos = await listUserRepos(state.githubToken);
		} catch (_error) {
			repos = [];
		}
	}

	const payload = extensionStateResponseSchema.parse({
		auth: state.auth,
		settings: state.settings,
		repos,
		lastSubmission: state.lastSubmission,
		lastSubmissionAccepted: state.lastSubmissionAccepted,
		lastIngestion: state.lastIngestion,
		recentEvents: state.recentEvents,
	});

	sendResponse({ ok: true, data: payload });
};

export const handleSaveSettings: Handler<"saveSettings"> = async (data, sendResponse) => {
	const state = await getStoredState();
	await saveStoredState({
		...state,
		settings: data.settings,
	});
	sendResponse({ ok: true });
};

export const handleClearRecentEvents: Handler<"clearRecentEvents"> = async (
	_data,
	sendResponse
) => {
	await clearRecentEvents();
	sendResponse({ ok: true });
};
