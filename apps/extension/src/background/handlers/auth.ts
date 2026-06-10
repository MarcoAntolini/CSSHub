import {
	buildGithubAuthorizeUrl,
	exchangeWebAuthCode,
	requestWebOAuthState,
	startDeviceFlow,
	pollDeviceFlow,
} from "@/githubAuth";
import { fetchAuthenticatedUser } from "@/githubClient";
import { clearAuthState, getStoredState, saveStoredState } from "@/storage";
import type { Handler } from "./types";

const runLaunchWebAuthFlow = async (url: string): Promise<string> =>
	new Promise((resolve, reject) => {
		chrome.identity.launchWebAuthFlow(
			{
				url,
				interactive: true,
			},
			(redirectedTo) => {
				const error = chrome.runtime.lastError;
				if (error) {
					reject(new Error(error.message));
					return;
				}
				if (!redirectedTo) {
					reject(new Error("OAuth web flow was cancelled"));
					return;
				}
				resolve(redirectedTo);
			}
		);
	});

export const handleStartGithubDeviceFlow: Handler<"startGithubDeviceFlow"> = async (
	_data,
	sendResponse
) => {
	const device = await startDeviceFlow();
	sendResponse({ ok: true, data: device });
};

export const handlePollGithubDeviceFlow: Handler<"pollGithubDeviceFlow"> = async (
	data,
	sendResponse
) => {
	const accessToken = await pollDeviceFlow(data.deviceCode);
	if (!accessToken) {
		sendResponse({
			ok: true,
			data: { status: "pending" },
		});
		return;
	}

	const username = await fetchAuthenticatedUser(accessToken);
	const state = await getStoredState();
	await saveStoredState({
		...state,
		githubToken: accessToken,
		auth: {
			isAuthenticated: true,
			username,
			method: "device",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

export const handleStartGithubWebFlow: Handler<"startGithubWebFlow"> = async (
	_data,
	sendResponse
) => {
	const redirectUri = chrome.identity.getRedirectURL("github");
	const { state, githubClientId } = await requestWebOAuthState();
	const authUrl = buildGithubAuthorizeUrl(githubClientId, redirectUri, state);
	const redirectedTo = await runLaunchWebAuthFlow(authUrl);
	const url = new URL(redirectedTo);
	const returnedState = url.searchParams.get("state");
	if (!returnedState || returnedState !== state) {
		throw new Error("OAuth state mismatch");
	}
	const code = url.searchParams.get("code");
	if (!code) {
		throw new Error("Missing OAuth authorization code");
	}

	const accessToken = await exchangeWebAuthCode(code, state, redirectUri);
	const username = await fetchAuthenticatedUser(accessToken);
	const current = await getStoredState();
	await saveStoredState({
		...current,
		githubToken: accessToken,
		auth: {
			isAuthenticated: true,
			username,
			method: "web",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

export const handleLoginWithPat: Handler<"loginWithPat"> = async (data, sendResponse) => {
	const username = await fetchAuthenticatedUser(data.token.trim());
	const current = await getStoredState();
	await saveStoredState({
		...current,
		githubToken: data.token.trim(),
		auth: {
			isAuthenticated: true,
			username,
			method: "pat",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

export const handleLogoutGithub: Handler<"logoutGithub"> = async (_data, sendResponse) => {
	await clearAuthState();
	sendResponse({ ok: true });
};
