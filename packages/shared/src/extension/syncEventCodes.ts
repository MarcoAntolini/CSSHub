import { z } from "zod";

export const syncIngestionEventCodeSchema = z.enum([
	"SYNC_COMMITTED",
	"SYNC_SKIPPED_DUPLICATE",
	"SYNC_SKIPPED_THRESHOLD",
	"SYNC_SKIPPED_NOT_IMPROVED",
	"SYNC_SKIPPED_INVALID_SCORE",
	"SYNC_SKIPPED_PREVIEW_UNAVAILABLE",
	"SYNC_AUTH_REQUIRED",
	"SYNC_REPO_REQUIRED",
]);

export type SyncIngestionEventCode = z.infer<typeof syncIngestionEventCodeSchema>;

export const backgroundEventCodeSchema = z.enum([
	...syncIngestionEventCodeSchema.options,
	"AUTH_STATE_MISMATCH",
	"AUTH_SESSION_EXPIRED",
	"AUTH_REDIRECT_INVALID",
	"AUTH_BACKEND_REQUEST_INVALID",
	"AUTH_OAUTH_EXCHANGE_FAILED",
	"AUTH_OAUTH_CODE_MISSING",
	"AUTH_GITHUB_UNAUTHORIZED",
	"GITHUB_NOT_FOUND",
	"GITHUB_CONFLICT",
	"GITHUB_RATE_LIMIT",
	"GITHUB_UNAVAILABLE",
	"NETWORK_ERROR",
	"UNEXPECTED_ERROR",
]);

export type BackgroundEventCode = z.infer<typeof backgroundEventCodeSchema>;

export type StatusTone = "success" | "warn" | "error" | "neutral";

const WARN_CODES = new Set<string>([
	"SYNC_SKIPPED_NOT_IMPROVED",
	"SYNC_SKIPPED_THRESHOLD",
	"SYNC_SKIPPED_INVALID_SCORE",
	"SYNC_SKIPPED_DUPLICATE",
	"SYNC_SKIPPED_PREVIEW_UNAVAILABLE",
]);

const ERROR_CODES = new Set<string>([
	"SYNC_AUTH_REQUIRED",
	"SYNC_REPO_REQUIRED",
	"GITHUB_NOT_FOUND",
	"GITHUB_CONFLICT",
	"GITHUB_RATE_LIMIT",
	"GITHUB_UNAVAILABLE",
	"NETWORK_ERROR",
	"UNEXPECTED_ERROR",
	"AUTH_GITHUB_UNAUTHORIZED",
	"AUTH_STATE_MISMATCH",
	"AUTH_OAUTH_CODE_MISSING",
]);

export const toneFromSyncEventCode = (code?: string): StatusTone => {
	if (!code) {
		return "neutral";
	}
	if (code === "SYNC_COMMITTED") {
		return "success";
	}
	if (ERROR_CODES.has(code)) {
		return "error";
	}
	if (WARN_CODES.has(code)) {
		return "warn";
	}
	return "neutral";
};
