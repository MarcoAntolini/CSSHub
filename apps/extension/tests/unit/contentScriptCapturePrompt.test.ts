// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	hideCaptureFailurePrompt,
	showCaptureFailurePrompt,
} from "@/contentScriptCapturePrompt";

describe("contentScriptCapturePrompt", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("renders a concise capture failure prompt with guidance", () => {
		showCaptureFailurePrompt(["preview-image", "last-score"]);

		const prompt = document.getElementById("csshub-capture-warning");
		expect(prompt).not.toBeNull();
		expect(prompt?.textContent).toContain("Capture failed");
		expect(prompt?.textContent).toContain("Missing preview image, Last score");
		expect(prompt?.textContent).toContain("Submit again once the page finishes updating.");
		expect(prompt?.textContent).toContain("Disable extensions that modify CSSBattle");
		expect(prompt?.textContent).not.toContain("Could not capture submission");
	});

	it("updates the same element on repeated failures", () => {
		showCaptureFailurePrompt(["editor-code"]);
		showCaptureFailurePrompt(["target-image"]);

		expect(document.querySelectorAll("#csshub-capture-warning")).toHaveLength(1);
		expect(document.getElementById("csshub-capture-warning")?.textContent).toContain(
			"Missing target image"
		);
	});

	it("dismiss hides only the in-page prompt", () => {
		showCaptureFailurePrompt(["editor-code"]);
		document.getElementById("csshub-capture-warning")?.querySelector("button")?.click();

		expect(document.getElementById("csshub-capture-warning")).toBeNull();
	});

	it("hideCaptureFailurePrompt removes the element", () => {
		showCaptureFailurePrompt(["editor-code"]);
		hideCaptureFailurePrompt();
		expect(document.getElementById("csshub-capture-warning")).toBeNull();
	});
});
