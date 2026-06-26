/**
 * Failed Capture Attempt detection — runs before Sync; incomplete DOM reads never
 * become Submissions. Distinct from Skipped Submissions (evaluated by Sync).
 */

import type { ChallengeContext } from "./contentScriptChallengeContext";
import type { SubmissionStats } from "./contentScriptStats";
import { isScoreUnavailableInDocument } from "./contentScriptStats";
import type { SubmissionPayload } from "./shared/contracts";

export const CAPTURE_ISSUE_IDS = [
	"challenge-metadata",
	"challenge-id",
	"challenge-name",
	"last-score",
	"match-percentage",
	"editor-code",
	"target-image",
	"preview-image",
] as const;

export type CaptureIssueId = (typeof CAPTURE_ISSUE_IDS)[number];

export const CAPTURE_ISSUE_LABELS: Record<CaptureIssueId, string> = {
	"challenge-metadata": "challenge metadata",
	"challenge-id": "challenge id",
	"challenge-name": "challenge name",
	"last-score": "Last score",
	"match-percentage": "match percentage",
	"editor-code": "editor code",
	"target-image": "target image",
	"preview-image": "preview image",
};

export const CAPTURE_FAILURE_UNSUPPORTED_REASON =
	"Could not capture submission: missing challenge metadata (CSSBattle header/breadcrumbs). Check if another extension is hiding or modifying the page header.";

export const formatMissingFieldsList = (issueIds: readonly CaptureIssueId[]): string =>
	issueIds.map((id) => CAPTURE_ISSUE_LABELS[id]).join(", ");

export const formatCaptureFailureReason = (
	issueIds: readonly CaptureIssueId[],
	options?: { unsupportedContext?: boolean }
): string => {
	if (options?.unsupportedContext && issueIds.includes("challenge-metadata")) {
		return CAPTURE_FAILURE_UNSUPPORTED_REASON;
	}
	return `Could not capture submission: missing ${formatMissingFieldsList(issueIds)}`;
};

export type CaptureValidationInput = {
	challengeContext: ChallengeContext;
	challengeId: string;
	challengeName: string;
	stats: SubmissionStats;
	code: string;
	targetImage: SubmissionPayload["targetImage"];
	resultImageDataUrl: string | null;
	documentRoot?: Document | Element;
};

export const detectCaptureIssues = (input: CaptureValidationInput): CaptureIssueId[] => {
	const issues: CaptureIssueId[] = [];
	const root = input.documentRoot;

	if (input.challengeContext.mode === "unsupported") {
		issues.push("challenge-metadata");
		return issues;
	}

	if (!input.challengeId || input.challengeId === "unknown") {
		issues.push("challenge-id");
	}

	if (!input.challengeName.trim()) {
		issues.push("challenge-name");
	}

	const scoreUnavailable = root
		? isScoreUnavailableInDocument(root)
		: input.stats.score === null;

	if (scoreUnavailable) {
		issues.push("last-score");
	} else if (input.stats.matchPct === null) {
		issues.push("match-percentage");
	}

	if (!input.code.trim()) {
		issues.push("editor-code");
	}

	if (!input.targetImage) {
		issues.push("target-image");
	}

	if (!input.resultImageDataUrl) {
		issues.push("preview-image");
	}

	return issues;
};

export const getCaptureFailureTitle = (params: {
	challengeName?: string;
	challengeId?: string;
}): string => {
	if (params.challengeName?.trim()) {
		return params.challengeName.trim();
	}
	if (params.challengeId && params.challengeId !== "unknown") {
		return `#${params.challengeId}`;
	}
	return "Capture failed";
};
