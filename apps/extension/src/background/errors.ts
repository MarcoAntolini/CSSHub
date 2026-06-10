import type { BackgroundEventCode } from "@/shared/contracts";
import { GithubApiError, getGithubErrorStatus } from "@/github/githubError";

export type SyncEventCode = BackgroundEventCode;

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

const getRawErrorMessage = (error: unknown): string => {
	if (error instanceof GithubApiError) {
		return error.message;
	}
	return error instanceof Error ? error.message : "Unexpected background failure";
};

const getGithubDetail = (error: unknown, rawMessage: string): string | null => {
	if (error instanceof GithubApiError) {
		return parseGithubErrorDetail(error.detail);
	}
	return parseGithubErrorDetail(rawMessage);
};

export const toUserSafeError = (
	error: unknown
): { message: string; code: SyncEventCode } => {
	const rawMessage = getRawErrorMessage(error);
	const githubStatus = getGithubErrorStatus(error);

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
		const detail = getGithubDetail(error, rawMessage);
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
