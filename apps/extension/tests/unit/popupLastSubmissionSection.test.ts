import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LastSubmissionSection } from "@/popup/LastSubmissionSection";
import type { CaptureFailure, SubmissionPayload } from "@/shared/contracts";

const lastSubmission: SubmissionPayload = {
	challengeMode: "daily",
	challengeId: "2026-06-23",
	challengeName: "Daily Target",
	challengeUrl: "https://cssbattle.dev/play/abc",
	submittedAt: "2026-06-23T17:00:00.000Z",
	score: 500,
	matchPct: 98,
	characterCount: 144,
	code: "<div></div>",
	targetImage: null,
	resultImageDataUrl: null,
};

describe("LastSubmissionSection", () => {
	it("replaces the last submission with a processing card while ingestion is active", () => {
		const markup = renderToStaticMarkup(
			createElement(LastSubmissionSection, {
				lastSubmission,
				lastIngestion: {
					accepted: true,
					threshold: 95,
					reason: "Synced successfully",
					committed: true,
					commitUrl: "https://github.com/owner/repo/commit/abc",
				},
				lastCaptureFailure: null,
				submissionProcessing: true,
			})
		);

		expect(markup).toContain("Processing submission");
		expect(markup).toContain("Capturing result and syncing to GitHub");
		expect(markup).not.toContain("Daily Target");
	});

	it("prefers lastCaptureFailure over lastSubmission", () => {
		const captureFailure: CaptureFailure = {
			timestamp: "2026-06-23T17:00:00.000Z",
			challengeName: "Neon 1",
			challengeId: "42",
			issueIds: ["preview-image"],
			reason: "Could not capture submission: missing preview image",
			code: "CAPTURE_FAILED",
		};
		const markup = renderToStaticMarkup(
			createElement(LastSubmissionSection, {
				lastSubmission,
				lastIngestion: {
					accepted: true,
					threshold: 95,
					reason: "Synced successfully",
					committed: true,
					commitUrl: null,
				},
				lastCaptureFailure: captureFailure,
				submissionProcessing: false,
			})
		);

		expect(markup).toContain("Last activity");
		expect(markup).toContain("Neon 1");
		expect(markup).toContain("capture failed");
		expect(markup).not.toContain("Daily Target");
	});

	it("uses generic capture title when challenge context is unknown", () => {
		const markup = renderToStaticMarkup(
			createElement(LastSubmissionSection, {
				lastSubmission: null,
				lastIngestion: null,
				lastCaptureFailure: {
					timestamp: "2026-06-23T17:00:00.000Z",
					issueIds: ["editor-code"],
					reason: "Could not capture submission: missing editor code",
					code: "CAPTURE_FAILED",
				},
				submissionProcessing: false,
			})
		);

		expect(markup).toContain("Capture failed");
	});
});
