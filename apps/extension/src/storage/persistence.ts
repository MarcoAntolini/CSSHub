import { STORAGE_KEY, TOKEN_KEY } from "./authSession";
import type { StoredState } from "./types";

export const readPersistedState = async (): Promise<{
	local: Partial<StoredState> | undefined;
	sessionToken: string | null;
}> => {
	const payload = await chrome.storage.local.get(STORAGE_KEY);
	const tokenPayload = await chrome.storage.session.get(TOKEN_KEY);
	const state = payload[STORAGE_KEY] as Partial<StoredState> | undefined;
	const sessionToken =
		typeof tokenPayload[TOKEN_KEY] === "string"
			? (tokenPayload[TOKEN_KEY] as string)
			: null;
	return { local: state, sessionToken };
};

export const writePersistedState = async (state: StoredState): Promise<void> => {
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

export const clearSessionToken = async (): Promise<void> => {
	await chrome.storage.session.remove(TOKEN_KEY);
};
