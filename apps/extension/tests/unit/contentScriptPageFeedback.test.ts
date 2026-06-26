// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	hidePageFeedbackPrompt,
	PROMPT_ELEMENT_ID,
	showCaptureFailurePrompt,
	showPageFeedbackPrompt,
	showProcessingPrompt,
	showSubmissionErrorPrompt,
	showSubmissionOutcomePrompt,
} from "@/contentScriptPageFeedback";

describe("contentScriptPageFeedback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = "";
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders a concise capture failure prompt with guidance", () => {
		showCaptureFailurePrompt(["preview-image", "last-score"]);

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt).not.toBeNull();
		expect(prompt?.dataset.tone).toBe("warn");
		expect(prompt?.textContent).toContain("Capture failed");
		expect(prompt?.textContent).toContain("Missing preview image, Last score");
		expect(prompt?.textContent).toContain("Submit again once the page finishes updating.");
		expect(prompt?.textContent).toContain("Disable extensions that modify CSSBattle");
		expect(prompt?.textContent).not.toContain("Could not capture submission");
	});

	it("renders the prompt as a compact status panel with a structured body", () => {
		showCaptureFailurePrompt(["editor-code"]);

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.style.backdropFilter).toContain("blur");
		expect(prompt?.style.borderTopColor).toBe("rgba(255, 255, 255, 0.1)");
		expect(prompt?.querySelector('[data-csshub-feedback-body="true"]')).not.toBeNull();
		expect(prompt?.querySelector('[data-csshub-feedback-accent="true"]')).not.toBeNull();
	});

	it("updates the same element on repeated prompts", () => {
		showCaptureFailurePrompt(["editor-code"]);
		showCaptureFailurePrompt(["target-image"]);

		expect(document.querySelectorAll(`#${PROMPT_ELEMENT_ID}`)).toHaveLength(1);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Missing target image"
		);
	});

	it("dismiss hides the in-page prompt", () => {
		showCaptureFailurePrompt(["editor-code"]);
		document.getElementById(PROMPT_ELEMENT_ID)?.querySelector("button")?.click();

		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("hidePageFeedbackPrompt removes the element", () => {
		showCaptureFailurePrompt(["editor-code"]);
		hidePageFeedbackPrompt();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("shows a processing prompt without a dismiss button", () => {
		showProcessingPrompt();

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.textContent).toContain("Processing submission");
		expect(prompt?.querySelector("button")).toBeNull();
	});

	it("shows a spinner instead of ellipsis for processing", () => {
		showProcessingPrompt();

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.querySelector('[data-csshub-feedback-spinner="true"]')).not.toBeNull();
		expect(prompt?.textContent).not.toContain("…");
		expect(prompt?.textContent).not.toContain("...");
	});

	it("shows success with a commit link and auto-hides after six seconds", () => {
		showSubmissionOutcomePrompt({
			accepted: true,
			threshold: 95,
			reason: "Submission committed to GitHub.",
			code: "SYNC_COMMITTED",
			committed: true,
			commitUrl: "https://github.com/o/r/commit/abc",
		});

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.textContent).toContain("Synced to GitHub");
		const link = prompt?.querySelector("a");
		expect(link?.textContent).toBe("View commit on GitHub");
		expect(link?.getAttribute("href")).toBe("https://github.com/o/r/commit/abc");
		expect(link?.style.borderRadius).toBe("999px");

		vi.advanceTimersByTime(5_999);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();

		vi.advanceTimersByTime(1);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("shows warn outcomes and auto-hides after ten seconds", () => {
		showSubmissionOutcomePrompt({
			accepted: false,
			threshold: 95,
			reason: "Below threshold.",
			code: "SYNC_SKIPPED_THRESHOLD",
			committed: false,
			commitUrl: null,
		});

		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Submission skipped"
		);

		vi.advanceTimersByTime(10_000);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("keeps error prompts visible until dismissed", () => {
		showSubmissionErrorPrompt("GitHub unavailable");

		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain("Sync failed");

		vi.advanceTimersByTime(30_000);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();
	});

	it("does not auto-hide capture failure prompts", () => {
		showCaptureFailurePrompt(["preview-image"]);

		vi.advanceTimersByTime(30_000);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();
	});

	it("replaces processing with the final outcome prompt", () => {
		showProcessingPrompt();
		showPageFeedbackPrompt({
			tone: "success",
			title: "Synced to GitHub",
			detail: "Done",
			autoHideMs: 6_000,
		});

		expect(document.querySelectorAll(`#${PROMPT_ELEMENT_ID}`)).toHaveLength(1);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Synced to GitHub"
		);
	});

	it("injects page feedback keyframes with a reduced-motion fallback once", () => {
		showProcessingPrompt();
		showCaptureFailurePrompt(["target-image"]);

		const style = document.getElementById("csshub-page-feedback-styles");
		expect(style).not.toBeNull();
		expect(style?.textContent).toContain("@keyframes csshub-feedback-enter");
		expect(style?.textContent).toContain("prefers-reduced-motion:reduce");
		expect(document.querySelectorAll("#csshub-page-feedback-styles")).toHaveLength(1);
	});
});
