export type SyncEventCode =
	| "SYNC_COMMITTED"
	| "SYNC_SKIPPED_DUPLICATE"
	| "SYNC_SKIPPED_THRESHOLD"
	| "SYNC_SKIPPED_NOT_IMPROVED"
	| "SYNC_SKIPPED_INVALID_SCORE"
	| "SYNC_AUTH_REQUIRED"
	| "SYNC_REPO_REQUIRED"
	| "AUTH_STATE_MISMATCH"
	| "AUTH_OAUTH_CODE_MISSING"
	| "AUTH_GITHUB_UNAUTHORIZED"
	| "GITHUB_NOT_FOUND"
	| "GITHUB_CONFLICT"
	| "GITHUB_RATE_LIMIT"
	| "GITHUB_UNAVAILABLE"
	| "NETWORK_ERROR"
	| "UNEXPECTED_ERROR";

const parseGithubStatus = (message: string): number | null => {
	const matched = message.match(/GitHub request failed \((\d{3})\)/);
	if (!matched) {
		return null;
	}
	const status = Number(matched[1]);
	return Number.isFinite(status) ? status : null;
};

const getRawErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unexpected background failure";

export const toUserSafeError = (
	error: unknown
): { message: string; code: SyncEventCode } => {
	const rawMessage = getRawErrorMessage(error);
	const githubStatus = parseGithubStatus(rawMessage);

	if (rawMessage.includes("OAuth state mismatch")) {
		return {
			message: "GitHub login validation failed. Please try again.",
			code: "AUTH_STATE_MISMATCH",
		};
	}
	if (rawMessage.includes("Missing OAuth authorization code")) {
		return {
			message: "GitHub login did not return an authorization code.",
			code: "AUTH_OAUTH_CODE_MISSING",
		};
	}
	if (githubStatus === 401 || githubStatus === 403) {
		return {
			message: "GitHub authentication failed. Reconnect your account.",
			code: "AUTH_GITHUB_UNAUTHORIZED",
		};
	}
	if (githubStatus === 404) {
		return {
			message: "Repository or branch not found. Verify repository settings.",
			code: "GITHUB_NOT_FOUND",
		};
	}
	if (githubStatus === 409 || githubStatus === 422) {
		return {
			message: "GitHub rejected this operation. Check repository and branch.",
			code: "GITHUB_CONFLICT",
		};
	}
	if (githubStatus === 429) {
		return {
			message: "GitHub rate limit reached. Retry in a few minutes.",
			code: "GITHUB_RATE_LIMIT",
		};
	}
	if (githubStatus !== null && githubStatus >= 500) {
		return {
			message: "GitHub is temporarily unavailable. Try again shortly.",
			code: "GITHUB_UNAVAILABLE",
		};
	}
	if (
		rawMessage.includes("Failed to fetch") ||
		rawMessage.includes("NetworkError")
	) {
		return {
			message: "Network error while contacting GitHub services.",
			code: "NETWORK_ERROR",
		};
	}

	return {
		message: "Operation failed. Check settings and try again.",
		code: "UNEXPECTED_ERROR",
	};
};
