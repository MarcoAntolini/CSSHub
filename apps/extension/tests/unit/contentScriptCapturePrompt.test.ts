// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	hideCaptureFailurePrompt,
	showCaptureFailurePrompt,
} from "@/contentScriptCapturePrompt";
import { PROMPT_ELEMENT_ID } from "@/contentScriptPageFeedback";

describe("contentScriptCapturePrompt re-exports", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("re-exports capture failure helpers from the page feedback module", () => {
		showCaptureFailurePrompt(["editor-code"]);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain("Capture failed");

		hideCaptureFailurePrompt();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});
});
