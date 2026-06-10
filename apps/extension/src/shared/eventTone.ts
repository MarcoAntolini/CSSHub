import type { SubmissionIngestionResponse, SyncEvent } from "./contracts";

export type StatusTone = "success" | "warn" | "error" | "neutral";

export const statusTextFromTone = (
	tone: StatusTone,
	neutralLabel = "info"
): string => {
	if (tone === "success") return "committed";
	if (tone === "error") return "failed";
	if (tone === "warn") return "skipped";
	return neutralLabel;
};

const WARN_CODES = new Set([
	"SYNC_SKIPPED_NOT_IMPROVED",
	"SYNC_SKIPPED_THRESHOLD",
	"SYNC_SKIPPED_INVALID_SCORE",
	"SYNC_SKIPPED_DUPLICATE",
	"SYNC_SKIPPED_PREVIEW_UNAVAILABLE",
]);

const ERROR_CODES = new Set([
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

const toneFromCode = (code?: string): StatusTone => {
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

export const getIngestionTone = (
	ingestion: SubmissionIngestionResponse | null
): StatusTone => {
	if (!ingestion) {
		return "neutral";
	}
	if (ingestion.committed) {
		return "success";
	}
	return toneFromCode(ingestion.code);
};

export const getSyncEventTone = (event: SyncEvent): StatusTone => {
	const codeTone = toneFromCode(event.code);
	if (codeTone !== "neutral") {
		return codeTone;
	}
	if (event.level === "error") {
		return "error";
	}
	if (event.level === "warn") {
		return "warn";
	}
	return "neutral";
};
