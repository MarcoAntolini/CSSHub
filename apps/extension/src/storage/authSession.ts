import type { AuthStatus } from "@/shared/contracts";

export const STORAGE_KEY = "csshub_state_v1";
export const TOKEN_KEY = "csshub_github_token_v1";

export const parseAuthFromLocal = (auth: Partial<AuthStatus> | undefined): AuthStatus => ({
	isAuthenticated: Boolean(auth?.isAuthenticated),
	username: typeof auth?.username === "string" ? auth.username : null,
	method:
		auth?.method === "device" || auth?.method === "web" || auth?.method === "pat"
			? auth.method
			: null,
});

export const reconcileAuthWithSession = (
	authFromLocal: AuthStatus,
	hasSessionToken: boolean
): AuthStatus =>
	hasSessionToken
		? authFromLocal
		: {
				isAuthenticated: false,
				username: null,
				method: null,
			};
