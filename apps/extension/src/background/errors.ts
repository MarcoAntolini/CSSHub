export type SyncEventCode =
	| "SYNC_COMMITTED"
	| "SYNC_SKIPPED_DUPLICATE"
	| "SYNC_SKIPPED_THRESHOLD"
	| "SYNC_SKIPPED_NOT_IMPROVED"
	| "SYNC_SKIPPED_INVALID_SCORE"
	| "SYNC_SKIPPED_PREVIEW_UNAVAILABLE"
	| "SYNC_AUTH_REQUIRED"
	| "SYNC_REPO_REQUIRED"
	| "AUTH_STATE_MISMATCH"
	| "AUTH_SESSION_EXPIRED"
	| "AUTH_REDIRECT_INVALID"
	| "AUTH_BACKEND_REQUEST_INVALID"
	| "AUTH_OAUTH_EXCHANGE_FAILED"
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

const parseGithubErrorDetail = (message: string): string | null => {
	const jsonStart = message.indexOf("{");
	if (jsonStart === -1) {
		return null;
	}
	try {
		const payload = JSON.parse(message.slice(jsonStart)) as {
			message?: unknown;
			errors?: Array<{ message?: unknown }>;
		};
		if (typeof payload.message === "string" && payload.message.trim()) {
			return payload.message.trim();
		}
		const nested = payload.errors
			?.map((entry) => (typeof entry.message === "string" ? entry.message.trim() : ""))
			.filter(Boolean)
			.join("; ");
		return nested || null;
	} catch (_error) {
		return null;
	}
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
	if (rawMessage.includes("Invalid or expired OAuth state")) {
		return {
			message: "GitHub login session expired. Please try again.",
			code: "AUTH_SESSION_EXPIRED",
		};
	}
	if (rawMessage.includes("Invalid redirect URI")) {
		return {
			message:
				"This extension build is not authorized for GitHub sign-in. Contact support.",
			code: "AUTH_REDIRECT_INVALID",
		};
	}
	if (rawMessage.includes("Invalid request payload")) {
		return {
			message:
				"GitHub sign-in could not reach the OAuth backend correctly. Please update the extension and try again.",
			code: "AUTH_BACKEND_REQUEST_INVALID",
		};
	}
	if (rawMessage.includes("Missing OAuth authorization code")) {
		return {
			message: "GitHub login did not return an authorization code.",
			code: "AUTH_OAUTH_CODE_MISSING",
		};
	}
	if (rawMessage.includes("OAuth exchange failed")) {
		return {
			message:
				"GitHub did not complete sign-in. Verify the OAuth callback setup and try again.",
			code: "AUTH_OAUTH_EXCHANGE_FAILED",
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
		const detail = parseGithubErrorDetail(rawMessage);
		const isFastForward =
			detail?.toLowerCase().includes("not a fast forward") ?? false;
		if (isFastForward) {
			return {
				message:
					"Another commit landed on the sync branch before this one finished. CssHub retried automatically; submit once more if needed.",
				code: "GITHUB_CONFLICT",
			};
		}
		return {
			message: detail
				? `GitHub rejected the commit: ${detail}`
				: "GitHub rejected the commit. Wait a few seconds and submit again.",
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
