// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	hideCaptureFailurePrompt,
	showCaptureFailurePrompt,
} from "@/contentScriptCapturePrompt";
import {
	FEEDBACK_EXIT_MS,
	PROMPT_ELEMENT_ID,
	resetPageFeedbackStateForTests,
} from "@/contentScriptPageFeedback";

describe("contentScriptCapturePrompt re-exports", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = "";
		resetPageFeedbackStateForTests();
	});

	afterEach(() => {
		resetPageFeedbackStateForTests();
		vi.useRealTimers();
	});

	it("re-exports capture failure helpers from the page feedback module", async () => {
		showCaptureFailurePrompt(["editor-code"]);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain("Capture failed");

		hideCaptureFailurePrompt();
		await vi.advanceTimersByTimeAsync(FEEDBACK_EXIT_MS + 40);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});
});
