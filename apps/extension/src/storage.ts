import {
	extensionSettingsSchema,
	submissionPayloadSchema,
	submissionIngestionResponseSchema,
	syncEventSchema,
	type AuthStatus,
	type ExtensionSettings,
	type PopupToBackgroundMessage,
	type SubmissionIngestionResponse,
	type SyncEvent,
} from "./shared/contracts";

export type StoredState = {
	githubToken: string | null;
	auth: AuthStatus;
	settings: ExtensionSettings;
	lastSubmission: Extract<PopupToBackgroundMessage, { action: "cssbattleSubmission" }>["payload"] | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
	recentEvents: SyncEvent[];
	lastSubmissionFingerprint: string | null;
};

const STORAGE_KEY = "csshub_state_v1";
const TOKEN_KEY = "csshub_github_token_v1";

const defaultState: StoredState = {
	githubToken: null,
	auth: {
		isAuthenticated: false,
		username: null,
		method: null,
	},
	settings: {
		threshold: 95,
		selectedRepoFullName: null,
		selectedBranch: null,
	},
	lastSubmission: null,
	lastSubmissionAccepted: null,
	lastIngestion: null,
	recentEvents: [],
	lastSubmissionFingerprint: null,
};

export const getStoredState = async (): Promise<StoredState> => {
	const payload = await chrome.storage.local.get(STORAGE_KEY);
	const tokenPayload = await chrome.storage.session.get(TOKEN_KEY);
	const state = payload[STORAGE_KEY] as Partial<StoredState> | undefined;
	const sessionToken =
		typeof tokenPayload[TOKEN_KEY] === "string"
			? (tokenPayload[TOKEN_KEY] as string)
			: defaultState.githubToken;

	if (!state) {
		return {
			...defaultState,
			githubToken: sessionToken,
		};
	}

	const settings = extensionSettingsSchema.safeParse(state.settings);
	const lastSubmission = submissionPayloadSchema.safeParse(state.lastSubmission);
	const lastIngestion = submissionIngestionResponseSchema.safeParse(state.lastIngestion);
	const recentEvents = syncEventSchema.array().safeParse(state.recentEvents);

	return {
		githubToken:
			sessionToken,
		auth: {
			isAuthenticated: Boolean(state.auth?.isAuthenticated),
			username:
				typeof state.auth?.username === "string" ? state.auth.username : null,
			method:
				state.auth?.method === "device" ||
				state.auth?.method === "web" ||
				state.auth?.method === "pat"
					? state.auth.method
					: null,
		},
		settings: settings.success ? settings.data : defaultState.settings,
		lastSubmission: lastSubmission.success ? lastSubmission.data : null,
		lastSubmissionAccepted:
			typeof state.lastSubmissionAccepted === "boolean"
				? state.lastSubmissionAccepted
				: null,
		lastIngestion: lastIngestion.success ? lastIngestion.data : null,
		recentEvents: recentEvents.success ? recentEvents.data : [],
		lastSubmissionFingerprint:
			typeof state.lastSubmissionFingerprint === "string"
				? state.lastSubmissionFingerprint
				: null,
	};
};

export const saveStoredState = async (state: StoredState): Promise<void> => {
	await chrome.storage.session.set({
		[TOKEN_KEY]: state.githubToken,
	});

	const persistableState: StoredState = {
		...state,
		githubToken: null,
	};

	await chrome.storage.local.set({
		[STORAGE_KEY]: persistableState,
	});
};

export const clearAuthState = async (): Promise<StoredState> => {
	const current = await getStoredState();
	const next: StoredState = {
		...current,
		githubToken: null,
		auth: {
			isAuthenticated: false,
			username: null,
			method: null,
		},
	};
	await saveStoredState(next);
	await chrome.storage.session.remove(TOKEN_KEY);
	return next;
};

export const clearRecentEvents = async (): Promise<StoredState> => {
	const current = await getStoredState();
	const next: StoredState = {
		...current,
		recentEvents: [],
	};
	await saveStoredState(next);
	return next;
};
