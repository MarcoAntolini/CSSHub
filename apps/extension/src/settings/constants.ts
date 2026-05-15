export const SETTINGS_PAGE_ICON_SRC = chrome.runtime.getURL("icons/icon_128.png");
export const SETTINGS_HERO_TAGLINE =
	"Sync CSSBattle submissions to GitHub — configure account and repository here.";

export const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;
export const EVENT_BADGE_LABELS: Partial<Record<string, string>> = {
	SYNC_COMMITTED: "committed",
	SYNC_SKIPPED_DUPLICATE: "duplicate",
	SYNC_SKIPPED_THRESHOLD: "below threshold",
	SYNC_SKIPPED_NOT_IMPROVED: "best kept",
	SYNC_SKIPPED_INVALID_SCORE: "invalid score",
	SYNC_AUTH_REQUIRED: "auth required",
	SYNC_REPO_REQUIRED: "repo required",
	AUTH_STATE_MISMATCH: "oauth mismatch",
	AUTH_OAUTH_CODE_MISSING: "oauth code missing",
	AUTH_GITHUB_UNAUTHORIZED: "github auth failed",
	GITHUB_NOT_FOUND: "not found",
	GITHUB_CONFLICT: "github conflict",
	GITHUB_RATE_LIMIT: "rate limit",
	GITHUB_UNAVAILABLE: "github unavailable",
	NETWORK_ERROR: "network error",
	UNEXPECTED_ERROR: "unexpected error",
};

export const MODAL_FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
